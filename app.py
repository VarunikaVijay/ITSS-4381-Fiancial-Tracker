from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_from_directory
import pandas as pd
from datetime import datetime, date
import os
import json
import uuid

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = 'your-secret-key'

# Global data storage (in production, use a proper database)
users = {}
transactions = {}
settings = {}
chat_history = {}

# Your transaction classes
class Transaction():
    def __init__(self, name, amount, date, category, id=None):
        self.id = id or str(uuid.uuid4())
        self.name = name
        self.amount = float(amount)
        self.date = date
        self.category = category
        self.type = 'expense' if amount < 0 else 'income'
        self.notes = ''
        self.attributes = {}
        self.status = 'confirmed'
        self.recurringId = None
        self.autoConfirm = False

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "amount": self.amount,
            "date": self.date,
            "category": self.category,
            "type": self.type,
            "notes": self.notes,
            "attributes": self.attributes,
            "status": self.status,
            "recurringId": self.recurringId,
            "autoConfirm": self.autoConfirm
        }

    @classmethod
    def from_dict(cls, data):
        transaction = cls(
            name=data['name'],
            amount=data['amount'],
            date=data['date'],
            category=data.get('category', ''),
            id=data.get('id')
        )
        transaction.type = data.get('type', 'expense')
        transaction.notes = data.get('notes', '')
        transaction.attributes = data.get('attributes', {})
        transaction.status = data.get('status', 'confirmed')
        transaction.recurringId = data.get('recurringId')
        transaction.autoConfirm = data.get('autoConfirm', False)
        return transaction

class FoodTransaction(Transaction):
    def __init__(self, name, amount, date, category, restaurant_name, meal_type, id=None):
        super().__init__(name, amount, date, category, id)
        self.restaurant_name = restaurant_name
        self.meal_type = meal_type
        self.attributes = {
            'restaurant_name': restaurant_name,
            'meal_type': meal_type
        }

    def to_dict(self):
        transaction_dict = super().to_dict()
        transaction_dict["restaurant_name"] = self.restaurant_name
        transaction_dict["meal_type"] = self.meal_type
        return transaction_dict

class TripTransaction(Transaction):
    def __init__(self, name, amount, date, category, destination, travel_method, id=None):
        super().__init__(name, amount, date, category, id)
        self.destination = destination
        self.travel_method = travel_method
        self.attributes = {
            'destination': destination,
            'travel_method': travel_method
        }

    def to_dict(self):
        transaction_dict = super().to_dict()
        transaction_dict["destination"] = self.destination
        transaction_dict["travel_method"] = self.travel_method
        return transaction_dict

# File handling
def save_transactions(user_id):
    if user_id in transactions:
        with open(f'transactions_{user_id}.json', 'w') as f:
            json.dump([t.to_dict() for t in transactions[user_id]], f, indent=2)

def load_transactions(user_id):
    try:
        with open(f'transactions_{user_id}.json', 'r') as f:
            data = json.load(f)
            return [Transaction.from_dict(item) for item in data]
    except FileNotFoundError:
        return []

def save_settings(user_id):
    if user_id in settings:
        with open(f'settings_{user_id}.json', 'w') as f:
            json.dump(settings[user_id], f, indent=2)

def load_settings(user_id):
    try:
        with open(f'settings_{user_id}.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {
            'currency': 'USD',
            'notifications': True,
            'autoCategorize': False,
            'selectedCategories': ['food', 'transportation', 'entertainment', 'shopping', 'bills', 'groceries'],
            'budgetType': 'dollar',
            'budgetValues': {'dollar': {}, 'percentage': {}},
            'recurringTransactions': [],
            'theme': 'dark'
        }

def save_chat_history(user_id):
    if user_id in chat_history:
        with open(f'chat_history_{user_id}.json', 'w') as f:
            json.dump(chat_history[user_id], f, indent=2)

def load_chat_history(user_id):
    try:
        with open(f'chat_history_{user_id}.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

# API Routes
@app.route('/api/transactions', methods=['GET', 'POST', 'PUT', 'DELETE'])
def api_transactions():
    user_id = request.headers.get('X-User-ID')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    if user_id not in transactions:
        transactions[user_id] = load_transactions(user_id)
    
    if request.method == 'GET':
        return jsonify([t.to_dict() for t in transactions[user_id]])
    
    elif request.method == 'POST':
        data = request.get_json()
        
        # Create transaction based on category
        if data.get('category') == 'food':
            transaction = FoodTransaction(
                name=data['name'],
                amount=data['amount'],
                date=data['date'],
                category=data['category'],
                restaurant_name=data.get('attributes', {}).get('restaurant_name', ''),
                meal_type=data.get('attributes', {}).get('meal_type', '')
            )
        elif data.get('category') == 'trip':
            transaction = TripTransaction(
                name=data['name'],
                amount=data['amount'],
                date=data['date'],
                category=data['category'],
                destination=data.get('attributes', {}).get('destination', ''),
                travel_method=data.get('attributes', {}).get('travel_method', '')
            )
        else:
            transaction = Transaction(
                name=data['name'],
                amount=data['amount'],
                date=data['date'],
                category=data.get('category', '')
            )
        
        # Set additional properties
        transaction.type = data.get('type', 'expense')
        transaction.notes = data.get('notes', '')
        transaction.attributes = data.get('attributes', {})
        transaction.status = data.get('status', 'confirmed')
        transaction.recurringId = data.get('recurringId')
        transaction.autoConfirm = data.get('autoConfirm', False)
        
        transactions[user_id].append(transaction)
        save_transactions(user_id)
        
        return jsonify(transaction.to_dict()), 201
    
    elif request.method == 'PUT':
        data = request.get_json()
        transaction_id = data.get('id')
        
        # Find and update transaction
        for i, transaction in enumerate(transactions[user_id]):
            if transaction.id == transaction_id:
                transaction.name = data['name']
                transaction.amount = float(data['amount'])
                transaction.date = data['date']
                transaction.category = data.get('category', '')
                transaction.type = data.get('type', 'expense')
                transaction.notes = data.get('notes', '')
                transaction.attributes = data.get('attributes', {})
                
                save_transactions(user_id)
                return jsonify(transaction.to_dict())
        
        return jsonify({'error': 'Transaction not found'}), 404
    
    elif request.method == 'DELETE':
        transaction_id = request.args.get('id')
        
        # Find and delete transaction
        for i, transaction in enumerate(transactions[user_id]):
            if transaction.id == transaction_id:
                del transactions[user_id][i]
                save_transactions(user_id)
                return jsonify({'success': True})
        
        return jsonify({'error': 'Transaction not found'}), 404

@app.route('/api/settings', methods=['GET', 'POST'])
def api_settings():
    user_id = request.headers.get('X-User-ID')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    if user_id not in settings:
        settings[user_id] = load_settings(user_id)
    
    if request.method == 'GET':
        return jsonify(settings[user_id])
    
    elif request.method == 'POST':
        data = request.get_json()
        settings[user_id].update(data)
        save_settings(user_id)
        return jsonify({'success': True})

@app.route('/api/users', methods=['POST'])
def api_users():
    data = request.get_json()
    
    if data.get('action') == 'register':
        email = data.get('email')
        password = data.get('password')
        
        if email in users:
            return jsonify({'error': 'User already exists'}), 400
        
        user_id = str(uuid.uuid4())
        users[email] = {
            'id': user_id,
            'email': email,
            'password': password  # In production, hash this password
        }
        
        # Initialize user data
        transactions[user_id] = []
        settings[user_id] = load_settings(user_id)
        chat_history[user_id] = []
        
        return jsonify({'success': True, 'user_id': user_id})
    
    elif data.get('action') == 'login':
        email = data.get('email')
        password = data.get('password')
        
        if email in users and users[email]['password'] == password:
            user_id = users[email]['id']
            
            # Load user data
            if user_id not in transactions:
                transactions[user_id] = load_transactions(user_id)
            if user_id not in settings:
                settings[user_id] = load_settings(user_id)
            if user_id not in chat_history:
                chat_history[user_id] = load_chat_history(user_id)
            
            return jsonify({'success': True, 'user_id': user_id})
        else:
            return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/chat', methods=['GET', 'POST'])
def api_chat():
    user_id = request.headers.get('X-User-ID')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    if user_id not in chat_history:
        chat_history[user_id] = load_chat_history(user_id)
    
    if request.method == 'GET':
        return jsonify(chat_history[user_id])
    
    elif request.method == 'POST':
        data = request.get_json()
        message = {
            'sender': data.get('sender'),
            'message': data.get('message'),
            'timestamp': datetime.now().isoformat()
        }
        
        chat_history[user_id].append(message)
        save_chat_history(user_id)
        
        return jsonify({'success': True})

@app.route('/api/ai-response', methods=['POST'])
def api_ai_response():
    data = request.get_json()
    message = data.get('message')
    
    # Simple AI response (you can integrate with your cloud worker here)
    ai_response = f"I received your message: {message}. This is a placeholder response from the Flask backend."
    
    return jsonify({'response': ai_response})

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/add_transaction', methods=['GET', 'POST'])
def add_transaction():
    return send_from_directory('.', 'index.html')

@app.route('/add_food', methods=['GET', 'POST'])
def add_food():
    return send_from_directory('.', 'index.html')

@app.route('/add_trip', methods=['GET', 'POST'])
def add_trip():
    return send_from_directory('.', 'index.html')

@app.route('/view_transactions')
def view_transactions():
    return send_from_directory('.', 'index.html')

@app.route('/search')
def search():
    return send_from_directory('.', 'index.html')

@app.route('/messages')
def messages():
    return send_from_directory('.', 'index.html')

@app.route('/login')
def login():
    return send_from_directory('.', 'index.html')

@app.route('/settings')
def settings_page():
    return send_from_directory('.', 'index.html')

@app.route('/api/analytics')
def api_analytics():
    user_id = request.headers.get('X-User-ID')
    if not user_id or user_id not in transactions:
        return jsonify({
            'total_spent': 0,
            'total_transactions': 0,
            'avg_transaction': 0,
            'category_data': {},
            'monthly_data': {}
        })
    
    user_transactions = transactions[user_id]
    total_spent = sum(t.amount for t in user_transactions if t.amount < 0)
    total_transactions = len(user_transactions)
    avg_transaction = abs(total_spent) / total_transactions if total_transactions > 0 else 0
    
    # Category breakdown
    category_data = {}
    for transaction in user_transactions:
        if transaction.amount < 0:  # Only expenses
            category = transaction.category
            if category in category_data:
                category_data[category] += abs(transaction.amount)
            else:
                category_data[category] = abs(transaction.amount)
    
    # Monthly breakdown
    monthly_data = {}
    for transaction in user_transactions:
        if transaction.amount < 0:  # Only expenses
            try:
                date_obj = datetime.strptime(transaction.date, '%Y-%m-%d')
                month_key = date_obj.strftime('%B %Y')
                if month_key in monthly_data:
                    monthly_data[month_key] += abs(transaction.amount)
                else:
                    monthly_data[month_key] = abs(transaction.amount)
            except:
                pass
    
    return jsonify({
        'total_spent': abs(total_spent),
        'total_transactions': total_transactions,
        'avg_transaction': round(avg_transaction, 2),
        'category_data': category_data,
        'monthly_data': monthly_data
    })

@app.route('/api/cat-fact')
def cat_fact():
    try:
        import requests
        response = requests.get('https://catfact.ninja/fact')
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'fact': 'Cats are mysterious creatures who love to nap in sunbeams.'})
    except:
        return jsonify({'fact': 'Cats have been domesticated for over 4,000 years!'})

@app.route('/api/cat-image')
def cat_image():
    try:
        import requests
        response = requests.get('https://api.thecatapi.com/v1/images/search')
        if response.status_code == 200:
            data = response.json()
            return jsonify({'url': data[0]['url']})
        else:
            return jsonify({'url': 'https://placekitten.com/400/300'})
    except:
        return jsonify({'url': 'https://placekitten.com/400/300'})

if __name__ == '__main__':
    print("🚀 Flask Financial Tracker Backend Starting...")
    print("📊 Go to: http://127.0.0.1:5014")
    print("🔧 API endpoints available at /api/*")
    app.run(host='127.0.0.1', port=5014, debug=True) 
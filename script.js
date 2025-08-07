// Global variables
let transactions = [];
let settings = {
    currency: 'USD',
    notifications: true,
    autoCategorize: false,
    selectedCategories: ['food', 'transportation', 'entertainment', 'shopping', 'bills', 'groceries'],
    budgetType: 'dollar',
    budgetValues: { dollar: {}, percentage: {} },
    recurringTransactions: [],
    theme: 'dark'
};
let currentUser = null;
let users = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let dashboardStats = {
    totalSpent: true,
    totalIncome: true,
    netBalance: true,
    totalTransactions: true,
    averageTransaction: true,
    mostCommonCategory: true,
    highestSpendingCategory: true,
    largestTransaction: true,
    totalYearSpending: true
};

// Global chart variables
let categoryChart = null;
let dailyExpensesChart = null;

// API Base URL
const API_BASE_URL = 'http://127.0.0.1:5014/api';



// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    // Add user ID to headers if user is logged in
    if (currentUser && currentUser.id) {
        config.headers['X-User-ID'] = currentUser.id;
    }
    
    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Helper function to parse dates safely (fixes timezone issues)
function parseDate(dateString) {
    if (!dateString) return null;
    // Split the date string and create date in local timezone
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    checkAuthStatus();
    setDefaultDate();
    initializeBudgetManagement();
    
    // Initialize charts after a small delay to ensure DOM is ready
    setTimeout(() => {
        initializeCharts();
        updateDashboard(); // Update dashboard after charts are initialized
    }, 100);
    
    // Add form event listeners
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    console.log('Login form found:', loginForm);
    console.log('Register form found:', registerForm);
    
    if (loginForm) {
        try {
            loginForm.addEventListener('submit', handleLogin);
            console.log('Login form event listener attached successfully');
        } catch (error) {
            console.error('Error attaching login form event listener:', error);
        }
    } else {
        console.error('Login form not found!');
    }
    
    if (registerForm) {
        try {
            registerForm.addEventListener('submit', handleRegister);
            console.log('Register form event listener attached successfully');
        } catch (error) {
            console.error('Error attaching register form event listener:', error);
        }
    } else {
        console.error('Register form not found!');
    }
    
    // Add click handlers for login/register buttons
    const loginBtn = document.getElementById('loginButton');
    const registerBtn = document.getElementById('registerButton');
    
    console.log('Login button found:', loginBtn);
    console.log('Register button found:', registerBtn);
    
    // Add click handlers to the buttons
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            console.log('Login button clicked via event listener');
            handleLoginClick();
        });
        console.log('Login button event listener attached');
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', function(e) {
            console.log('Register button clicked via event listener');
            handleRegisterClick();
        });
        console.log('Register button event listener attached');
    }
    
    const transactionForm = document.getElementById('transactionForm');
    console.log('Transaction form element:', transactionForm);
    if (transactionForm) {
        // Remove any existing event listeners by cloning the form
        const newForm = transactionForm.cloneNode(true);
        transactionForm.parentNode.replaceChild(newForm, transactionForm);
        
        // Add the event listener to the new form
        newForm.addEventListener('submit', function(e) {
            console.log('Transaction form submit event triggered');
            e.preventDefault();
            e.stopPropagation();
            console.log('Calling addTransaction function...');
            addTransaction();
        });
        
        console.log('Transaction form event listener attached');
    } else {
        console.error('Transaction form not found!');
    }
    
    document.getElementById('editTransactionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateTransaction();
    });
    
    // Add recurring transaction event listeners
    const recurringFrequency = document.getElementById('recurringFrequency');
    if (recurringFrequency) {
        recurringFrequency.addEventListener('change', handleRecurringFrequencyChange);
    }
    
    // Add edit transaction category change listener
    const editTransactionCategory = document.getElementById('editTransactionCategory');
    if (editTransactionCategory) {
        editTransactionCategory.addEventListener('change', showEditCategoryAttributes);
    }
    
    // Add transaction type change listener
    const transactionType = document.getElementById('transactionType');
    if (transactionType) {
        transactionType.addEventListener('change', handleTransactionTypeChange);
    }
    
    // Initialize dashboard settings
    loadDashboardSettings();
    updateMonthDisplay();
    
    // Initialize chat functionality
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }
    
    // Handle window resize for chart responsiveness
    window.addEventListener('resize', () => {
        if (categoryChart) {
            categoryChart.resize();
        }
        if (dailyExpensesChart) {
            dailyExpensesChart.resize();
        }
    });
    
    // Check if financial-questions section is active and load chat history if needed
    setTimeout(() => {
        const financialQuestionsSection = document.getElementById('financial-questions');
        if (financialQuestionsSection && financialQuestionsSection.classList.contains('active')) {
            console.log('Financial questions section is active on page load, loading chat history');
            loadChatHistory();
        }
    }, 300);
    
    // Load theme preference
    loadThemePreference();

});

// Data management
function loadData() {
    const savedUsers = localStorage.getItem('users');
    const savedCurrentUser = localStorage.getItem('currentUser');
    
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        users = [];
    }
    
    if (savedCurrentUser) {
        currentUser = JSON.parse(savedCurrentUser);
        
        // Load user-specific data if user is logged in
        if (currentUser) {
            loadUserData();
        } else {
            // Load global data if no user is logged in
            const savedTransactions = localStorage.getItem('transactions');
            const savedSettings = localStorage.getItem('settings');
            
            if (savedTransactions) {
                transactions = JSON.parse(savedTransactions);
            }
            
            if (savedSettings) {
                settings = { ...settings, ...JSON.parse(savedSettings) };
            }
        }
    } else {
        // Load global data if no current user
        const savedTransactions = localStorage.getItem('transactions');
        const savedSettings = localStorage.getItem('settings');
        
        if (savedTransactions) {
            transactions = JSON.parse(savedTransactions);
        }
        
        if (savedSettings) {
            settings = { ...settings, ...JSON.parse(savedSettings) };
        }
    }
    
    // Set default budget type if not already set
    if (!settings.budgetType) {
        settings.budgetType = 'dollar';
    }
    
    // Initialize budget values storage if not exists
    if (!settings.budgetValues) {
        settings.budgetValues = { dollar: {}, percentage: {} };
    }
    
    // Load settings into UI (only if elements exist)
    if (document.getElementById('currencySelect')) {
        document.getElementById('currencySelect').value = settings.currency;
    }
    if (document.getElementById('notificationsEnabled')) {
        document.getElementById('notificationsEnabled').checked = settings.notifications;
    }
    if (document.getElementById('autoCategorize')) {
        document.getElementById('autoCategorize').checked = settings.autoCategorize;
    }
    
    // Initialize budget management for new budget system
    if (document.getElementById('categoryCards')) {
        initializeBudgetManagement();
    }
    
    // Update transaction categories to only show selected categories
    updateTransactionCategories();
    
    // Chat history will be loaded when the financial-questions section is shown
}

function saveData() {
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    if (currentUser) {
        saveUserData();
    } else {
        // Save to global storage if no user is logged in
        localStorage.setItem('transactions', JSON.stringify(transactions));
        localStorage.setItem('settings', JSON.stringify(settings));
    }
}

// Navigation
function showSection(sectionId) {
    console.log('=== showSection called with:', sectionId, '===');
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        console.log('Section activated:', sectionId);
    } else {
        console.error('Section not found:', sectionId);
    }
    
    // Add active class to corresponding nav link
    const navLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (navLink) {
        navLink.classList.add('active');
        console.log('Nav link activated for:', sectionId);
    } else {
        console.error('Nav link not found for:', sectionId);
    }
    
    // Update content based on section
    if (sectionId === 'transactions') {
        updateTransactionCategories();
        displayAllTransactions();
    } else if (sectionId === 'analytics') {
        updateAnalytics();
    } else if (sectionId === 'settings') {
        initializeBudgetManagement();
    } else if (sectionId === 'dashboard') {
        // Ensure charts are initialized before updating dashboard
        if (!categoryChart || !dailyExpensesChart) {
            setTimeout(() => {
                initializeCharts();
                updateDashboard();
            }, 50);
        } else {
            updateDashboard();
        }
    } else if (sectionId === 'financial-questions') {
        // Load chat history when financial questions section is shown
        // Use setTimeout to ensure DOM is ready and user is authenticated
        setTimeout(() => {
            console.log('Loading chat history for section:', sectionId);
            console.log('Current user:', currentUser);
            loadChatHistory();
        }, 100);
    }
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    // Reset form
    if (modalId === 'addTransactionModal') {
        document.getElementById('transactionForm').reset();
        setDefaultDate();
        // Hide category attributes
        document.getElementById('categoryAttributes').style.display = 'none';
        document.querySelectorAll('.category-attributes').forEach(attr => {
            attr.style.display = 'none';
        });
    }
}

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transactionDate').value = today;
}

// Handle transaction type change (show/hide category for income)
function handleTransactionTypeChange() {
    const transactionType = document.getElementById('transactionType').value;
    const categoryFormGroup = document.getElementById('categoryFormGroup');
    const categorySelect = document.getElementById('transactionCategory');
    const categoryAttributesDiv = document.getElementById('categoryAttributes');
    
    if (transactionType === 'income') {
        // Hide category field for income
        categoryFormGroup.style.display = 'none';
        categorySelect.value = '';
        categoryAttributesDiv.style.display = 'none';
        categorySelect.removeAttribute('required');
    } else {
        // Show category field for expenses
        categoryFormGroup.style.display = 'block';
        categorySelect.setAttribute('required', 'required');
    }
}

// Show/hide category-specific attributes
function showCategoryAttributes() {
    const category = document.getElementById('transactionCategory').value;
    const attributesContainer = document.getElementById('categoryAttributes');
    
    // Hide all category attribute sections
    document.querySelectorAll('.category-attributes').forEach(attr => {
        attr.style.display = 'none';
    });
    
    // Show attributes container and specific category attributes
    if (category && category !== 'other') {
        attributesContainer.style.display = 'block';
        const categoryAttrId = category + 'Attributes';
        const categoryAttr = document.getElementById(categoryAttrId);
        if (categoryAttr) {
            categoryAttr.style.display = 'block';
        }
    } else {
        attributesContainer.style.display = 'none';
    }
}

// Get category-specific attributes
function getCategoryAttributes(category) {
    const attributes = [];
    
    switch(category) {
        case 'bills':
            attributes.push({ name: 'provider', label: 'Provider', type: 'text' });
            attributes.push({ name: 'dueDate', label: 'Due Date', type: 'date' });
            break;
        case 'entertainment':
            attributes.push({ name: 'type', label: 'Type', type: 'text' });
            attributes.push({ name: 'location', label: 'Location', type: 'text' });
            break;
        case 'healthcare':
            attributes.push({ name: 'provider', label: 'Provider', type: 'text' });
            attributes.push({ name: 'serviceType', label: 'Service Type', type: 'text' });
            break;
        case 'groceries':
            attributes.push({ name: 'store', label: 'Store', type: 'text' });
            attributes.push({ name: 'groceryType', label: 'Type', type: 'text' });
            break;
        case 'education':
            attributes.push({ name: 'institution', label: 'Institution', type: 'text' });
            attributes.push({ name: 'educationType', label: 'Type', type: 'text' });
            break;
        case 'gifts':
            attributes.push({ name: 'recipient', label: 'Recipient', type: 'text' });
            attributes.push({ name: 'occasion', label: 'Occasion', type: 'text' });
            break;
        case 'personal-care':
            attributes.push({ name: 'careType', label: 'Type', type: 'text' });
            attributes.push({ name: 'provider', label: 'Provider', type: 'text' });
            break;
        case 'home-maintenance':
            attributes.push({ name: 'maintenanceType', label: 'Type', type: 'text' });
            attributes.push({ name: 'area', label: 'Area', type: 'text' });
            break;
        case 'childcare':
            attributes.push({ name: 'childcareType', label: 'Type', type: 'text' });
            attributes.push({ name: 'provider', label: 'Provider', type: 'text' });
            break;
        case 'petcare':
            attributes.push({ name: 'petcareType', label: 'Type', type: 'text' });
            attributes.push({ name: 'provider', label: 'Provider', type: 'text' });
            break;
        case 'savings':
            attributes.push({ name: 'savingsType', label: 'Type', type: 'text' });
            attributes.push({ name: 'institution', label: 'Institution', type: 'text' });
            break;
        case 'transportation':
            attributes.push({ name: 'transportType', label: 'Type', type: 'text' });
            attributes.push({ name: 'provider', label: 'Provider', type: 'text' });
            break;
        case 'shopping':
            attributes.push({ name: 'shoppingType', label: 'Type', type: 'text' });
            attributes.push({ name: 'store', label: 'Store', type: 'text' });
            break;
        case 'food':
            attributes.push({ name: 'diningType', label: 'Type', type: 'text' });
            attributes.push({ name: 'restaurant', label: 'Restaurant', type: 'text' });
            break;
        case 'travel':
            attributes.push({ name: 'travelType', label: 'Type', type: 'text' });
            attributes.push({ name: 'destination', label: 'Destination', type: 'text' });
            break;
    }
    
    return attributes;
}

// Format category attributes for display
function formatCategoryAttributes(transaction) {
    if (!transaction.categoryAttributes || Object.keys(transaction.categoryAttributes).length === 0) {
        return '';
    }
    
    const attrs = transaction.categoryAttributes;
    const category = transaction.category;
    let formattedAttrs = [];
    
    switch(category) {
        case 'bills':
            if (attrs.provider) formattedAttrs.push(`Provider: ${attrs.provider}`);
            if (attrs.dueDate) formattedAttrs.push(`Due: ${formatDate(attrs.dueDate)}`);
            break;
        case 'entertainment':
            if (attrs.type) formattedAttrs.push(`Type: ${attrs.type}`);
            if (attrs.location) formattedAttrs.push(`Location: ${attrs.location}`);
            break;
        case 'healthcare':
            if (attrs.provider) formattedAttrs.push(`Provider: ${attrs.provider}`);
            if (attrs.serviceType) formattedAttrs.push(`Service: ${attrs.serviceType}`);
            break;
        case 'groceries':
            if (attrs.store) formattedAttrs.push(`Store: ${attrs.store}`);
            if (attrs.groceryType) formattedAttrs.push(`Type: ${attrs.groceryType}`);
            break;
        case 'education':
            if (attrs.institution) formattedAttrs.push(`Institution: ${attrs.institution}`);
            if (attrs.educationType) formattedAttrs.push(`Type: ${attrs.educationType}`);
            break;
        case 'gifts':
            if (attrs.recipient) formattedAttrs.push(`Recipient: ${attrs.recipient}`);
            if (attrs.occasion) formattedAttrs.push(`Occasion: ${attrs.occasion}`);
            break;
        case 'personal-care':
            if (attrs.careType) formattedAttrs.push(`Type: ${attrs.careType}`);
            if (attrs.provider) formattedAttrs.push(`Provider: ${attrs.provider}`);
            break;
        case 'home-maintenance':
            if (attrs.maintenanceType) formattedAttrs.push(`Type: ${attrs.maintenanceType}`);
            if (attrs.area) formattedAttrs.push(`Area: ${attrs.area}`);
            break;
        case 'childcare':
            if (attrs.childcareType) formattedAttrs.push(`Type: ${attrs.childcareType}`);
            if (attrs.provider) formattedAttrs.push(`Provider: ${attrs.provider}`);
            break;
        case 'petcare':
            if (attrs.petcareType) formattedAttrs.push(`Type: ${attrs.petcareType}`);
            if (attrs.provider) formattedAttrs.push(`Provider: ${attrs.provider}`);
            break;
        case 'savings':
            if (attrs.savingsType) formattedAttrs.push(`Type: ${attrs.savingsType}`);
            if (attrs.institution) formattedAttrs.push(`Institution: ${attrs.institution}`);
            break;
        case 'transportation':
            if (attrs.transportType) formattedAttrs.push(`Type: ${attrs.transportType}`);
            if (attrs.provider) formattedAttrs.push(`Provider: ${attrs.provider}`);
            break;
        case 'shopping':
            if (attrs.shoppingType) formattedAttrs.push(`Type: ${attrs.shoppingType}`);
            if (attrs.store) formattedAttrs.push(`Store: ${attrs.store}`);
            break;
        case 'food':
            if (attrs.diningType) formattedAttrs.push(`Type: ${attrs.diningType}`);
            if (attrs.restaurant) formattedAttrs.push(`Restaurant: ${attrs.restaurant}`);
            break;
        case 'travel':
            if (attrs.travelType) formattedAttrs.push(`Type: ${attrs.travelType}`);
            if (attrs.destination) formattedAttrs.push(`Destination: ${attrs.destination}`);
            break;
    }
    
    return formattedAttrs.length > 0 ? formattedAttrs.join(' • ') : '';
}

// Flags to prevent duplicate submissions and event listeners
let isSubmittingTransaction = false;
let transactionFormListenerAttached = false;

function addTransaction() {
    console.log('=== addTransaction function called ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('currentUser:', currentUser);
    console.log('isSubmittingTransaction before:', isSubmittingTransaction);
    
    // Prevent duplicate submissions
    if (isSubmittingTransaction) {
        console.log('Transaction submission already in progress, ignoring duplicate call');
        return;
    }
    
    isSubmittingTransaction = true;
    console.log('isSubmittingTransaction after setting:', isSubmittingTransaction);
    
    if (!currentUser) {
        console.log('No current user, showing error');
        showNotification('Please login to add transactions', 'error');
        isSubmittingTransaction = false;
        console.log('=== addTransaction function ended due to no user ===');
        return;
    }
    
    console.log('Getting form values...');
    const nameElement = document.getElementById('transactionName');
    const amountElement = document.getElementById('transactionAmount');
    const typeElement = document.getElementById('transactionType');
    const categoryElement = document.getElementById('transactionCategory');
    const dateElement = document.getElementById('transactionDate');
    const notesElement = document.getElementById('transactionNotes');
    const isRecurringElement = document.getElementById('isRecurring');
    
    console.log('Form elements:', { nameElement, amountElement, typeElement, categoryElement, dateElement, notesElement, isRecurringElement });
    
    if (!nameElement || !amountElement || !typeElement || !categoryElement || !dateElement || !notesElement || !isRecurringElement) {
        console.error('One or more form elements not found!');
        showNotification('Form elements not found. Please refresh the page.', 'error');
        return;
    }
    
    const name = nameElement.value;
    const amount = parseFloat(amountElement.value);
    const type = typeElement.value;
    const category = categoryElement.value;
    const date = dateElement.value;
    const notes = notesElement.value;
    const isRecurring = isRecurringElement.checked;
    
    console.log('Form values:', { name, amount, type, category, date, notes, isRecurring });
    
    if (!name || !amount || !date) {
        showNotification('Please fill in all required fields', 'error');
        isSubmittingTransaction = false;
        console.log('=== addTransaction function ended due to missing fields ===');
        return;
    }
    
    // For expenses, category is required
    if (type === 'expense' && !category) {
        showNotification('Please select a category for expenses', 'error');
        isSubmittingTransaction = false;
        console.log('=== addTransaction function ended due to missing category ===');
        return;
    }
    
    // Get category attributes (only for expenses)
    const attributes = type === 'expense' ? getCategoryAttributes(category) : {};
    
    const transaction = {
        id: Date.now(),
        name,
        amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        type,
        category: type === 'income' ? 'income' : category, // Use 'income' as category for income transactions
        date,
        notes,
        attributes,
        status: 'confirmed', // Default status for new transactions
        createdAt: new Date().toISOString()
    };
    
    // Handle recurring transaction setup
    if (isRecurring) {
        const frequency = document.getElementById('recurringFrequency').value;
        const endDate = document.getElementById('recurringEndDate').value;
        const autoConfirm = document.getElementById('autoConfirm').checked;
        const customDates = document.getElementById('customDates').value;
        
        if (!frequency) {
            showNotification('Please select a frequency for recurring transaction.', 'error');
            isSubmittingTransaction = false;
            console.log('=== addTransaction function ended due to missing frequency ===');
            return;
        }
        
        const recurringTransaction = {
            id: Date.now() + Math.random(),
            name,
            amount: Math.abs(amount),
            type,
            category,
            date,
            notes,
            attributes,
            frequency,
            endDate: endDate || null,
            autoConfirm,
            customDates: frequency === 'custom' ? customDates.split(',').map(d => d.trim()) : null,
            nextDueDate: calculateNextDueDate({
                frequency,
                endDate: endDate || null,
                customDates: frequency === 'custom' ? customDates.split(',').map(d => d.trim()) : null
            }, parseDate(date)).toISOString().split('T')[0]
        };
        
        if (!settings.recurringTransactions) {
            settings.recurringTransactions = [];
        }
        settings.recurringTransactions.push(recurringTransaction);
    }
    
    // Add to local array
    transactions.unshift(transaction);
    
    // Save data
    saveData();
    
    // Update UI
    updateDashboard();
    updateRecentTransactions();
    displayAllTransactions();
    updateBudgetProgressBars();
    updateCharts();
    
    // Reset form
    resetTransactionForm();
    
    // Close modal
    closeModal('addTransactionModal');
    
    showNotification('Transaction added successfully!');
    
    // Reset submission flag
    isSubmittingTransaction = false;
    console.log('=== addTransaction function completed ===');
    console.log('isSubmittingTransaction reset to:', isSubmittingTransaction);
}

function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        transactions = transactions.filter(transaction => transaction.id !== id);
        saveData();
        updateDashboard();
        displayAllTransactions();
        showNotification('Transaction deleted successfully');
    }
}

// Edit transaction functionality
function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) {
        showNotification('Transaction not found', 'error');
        return;
    }
    
    // Populate the edit form with transaction data
    document.getElementById('editTransactionId').value = transaction.id;
    document.getElementById('editTransactionName').value = transaction.name;
    document.getElementById('editTransactionAmount').value = Math.abs(transaction.amount);
    document.getElementById('editTransactionType').value = transaction.amount < 0 ? 'expense' : 'income';
    document.getElementById('editTransactionCategory').value = transaction.category;
    document.getElementById('editTransactionDate').value = transaction.date;
    document.getElementById('editTransactionNotes').value = transaction.notes || '';
    
    // Show category-specific attributes and populate them
    showEditCategoryAttributes();
    
    // Use setTimeout to ensure the category attributes are visible before populating
    setTimeout(() => {
        if (transaction.attributes) {
            const categoryAttrs = getCategoryAttributes(transaction.category);
            categoryAttrs.forEach(attr => {
                // Map attribute names to their actual input IDs based on category
                const attributeIdMap = {};
                
                switch(transaction.category) {
                    case 'bills':
                        attributeIdMap['provider'] = 'editBillsProvider';
                        attributeIdMap['dueDate'] = 'editBillsDueDate';
                        break;
                    case 'entertainment':
                        attributeIdMap['type'] = 'editEntertainmentType';
                        attributeIdMap['location'] = 'editEntertainmentLocation';
                        break;
                    case 'healthcare':
                        attributeIdMap['provider'] = 'editHealthcareProvider';
                        attributeIdMap['serviceType'] = 'editHealthcareType';
                        break;
                    case 'groceries':
                        attributeIdMap['store'] = 'editGroceriesStore';
                        attributeIdMap['groceryType'] = 'editGroceriesType';
                        break;
                    case 'education':
                        attributeIdMap['institution'] = 'editEducationInstitution';
                        attributeIdMap['educationType'] = 'editEducationType';
                        break;
                    case 'gifts':
                        attributeIdMap['recipient'] = 'editGiftsRecipient';
                        attributeIdMap['occasion'] = 'editGiftsOccasion';
                        break;
                    case 'personal-care':
                        attributeIdMap['careType'] = 'editPersonalCareType';
                        attributeIdMap['provider'] = 'editPersonalCareProvider';
                        break;
                    case 'home-maintenance':
                        attributeIdMap['maintenanceType'] = 'editHomeMaintenanceType';
                        attributeIdMap['area'] = 'editHomeMaintenanceArea';
                        break;
                    case 'childcare':
                        attributeIdMap['childcareType'] = 'editChildcareType';
                        attributeIdMap['provider'] = 'editChildcareProvider';
                        break;
                    case 'petcare':
                        attributeIdMap['petcareType'] = 'editPetcareType';
                        attributeIdMap['provider'] = 'editPetcareProvider';
                        break;
                    case 'savings':
                        attributeIdMap['savingsType'] = 'editSavingsType';
                        attributeIdMap['institution'] = 'editSavingsInstitution';
                        break;
                    case 'transportation':
                        attributeIdMap['transportType'] = 'editTransportationType';
                        attributeIdMap['provider'] = 'editTransportationProvider';
                        break;
                    case 'shopping':
                        attributeIdMap['shoppingType'] = 'editShoppingType';
                        attributeIdMap['store'] = 'editShoppingStore';
                        break;
                    case 'food':
                        attributeIdMap['diningType'] = 'editFoodType';
                        attributeIdMap['restaurant'] = 'editFoodRestaurant';
                        break;
                    case 'travel':
                        attributeIdMap['travelType'] = 'editTravelType';
                        attributeIdMap['destination'] = 'editTravelDestination';
                        break;
                }
                
                const inputId = attributeIdMap[attr.name];
                if (inputId && transaction.attributes[attr.name]) {
                    const input = document.getElementById(inputId);
                    if (input) {
                        input.value = transaction.attributes[attr.name];
                    }
                }
            });
        }
    }, 10);
    
    // Open the edit modal
    openModal('editTransactionModal');
}

function showEditCategoryAttributes() {
    const category = document.getElementById('editTransactionCategory').value;
    const attributesContainer = document.getElementById('editCategoryAttributes');
    
    // Hide all attribute groups first
    const allAttrGroups = attributesContainer.querySelectorAll('.category-attributes');
    allAttrGroups.forEach(group => group.style.display = 'none');
    
    if (category === 'other') {
        return; // No attributes for Other category
    }
    
    const attributes = getCategoryAttributes(category);
    
    if (attributes.length > 0) {
        // Map category names to their HTML element IDs
        const categoryIdMap = {
            'bills': 'editBillsAttributes',
            'entertainment': 'editEntertainmentAttributes',
            'healthcare': 'editHealthcareAttributes',
            'groceries': 'editGroceriesAttributes',
            'education': 'editEducationAttributes',
            'gifts': 'editGiftsAttributes',
            'personal-care': 'editPersonal-careAttributes',
            'home-maintenance': 'editHome-maintenanceAttributes',
            'childcare': 'editChildcareAttributes',
            'petcare': 'editPetcareAttributes',
            'savings': 'editSavingsAttributes',
            'transportation': 'editTransportationAttributes',
            'shopping': 'editShoppingAttributes',
            'food': 'editFoodAttributes',
            'travel': 'editTravelAttributes'
        };
        
        const attrGroupId = categoryIdMap[category];
        if (attrGroupId) {
            const attrGroup = document.getElementById(attrGroupId);
            if (attrGroup) {
                attrGroup.style.display = 'block';
                attributesContainer.style.display = 'block';
            }
        }
    }
}

function updateTransaction() {
    const id = parseInt(document.getElementById('editTransactionId').value);
    const name = document.getElementById('editTransactionName').value;
    const amount = parseFloat(document.getElementById('editTransactionAmount').value);
    const type = document.getElementById('editTransactionType').value;
    const category = document.getElementById('editTransactionCategory').value;
    const date = document.getElementById('editTransactionDate').value;
    const notes = document.getElementById('editTransactionNotes').value;
    
    // Validate required fields
    if (!name || !amount || !category || !date) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Find the transaction to update
    const transactionIndex = transactions.findIndex(t => t.id === id);
    if (transactionIndex === -1) {
        showNotification('Transaction not found', 'error');
        return;
    }
    
    // Calculate final amount based on type
    const finalAmount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
    
            // Collect category-specific attributes
        const attributes = {};
        if (category !== 'other') {
            const categoryAttrs = getCategoryAttributes(category);
            categoryAttrs.forEach(attr => {
                // Map attribute names to their actual input IDs based on category
                const attributeIdMap = {};
                
                switch(category) {
                    case 'bills':
                        attributeIdMap['provider'] = 'editBillsProvider';
                        attributeIdMap['dueDate'] = 'editBillsDueDate';
                        break;
                    case 'entertainment':
                        attributeIdMap['type'] = 'editEntertainmentType';
                        attributeIdMap['location'] = 'editEntertainmentLocation';
                        break;
                    case 'healthcare':
                        attributeIdMap['provider'] = 'editHealthcareProvider';
                        attributeIdMap['serviceType'] = 'editHealthcareType';
                        break;
                    case 'groceries':
                        attributeIdMap['store'] = 'editGroceriesStore';
                        attributeIdMap['groceryType'] = 'editGroceriesType';
                        break;
                    case 'education':
                        attributeIdMap['institution'] = 'editEducationInstitution';
                        attributeIdMap['educationType'] = 'editEducationType';
                        break;
                    case 'gifts':
                        attributeIdMap['recipient'] = 'editGiftsRecipient';
                        attributeIdMap['occasion'] = 'editGiftsOccasion';
                        break;
                    case 'personal-care':
                        attributeIdMap['careType'] = 'editPersonalCareType';
                        attributeIdMap['provider'] = 'editPersonalCareProvider';
                        break;
                    case 'home-maintenance':
                        attributeIdMap['maintenanceType'] = 'editHomeMaintenanceType';
                        attributeIdMap['area'] = 'editHomeMaintenanceArea';
                        break;
                    case 'childcare':
                        attributeIdMap['childcareType'] = 'editChildcareType';
                        attributeIdMap['provider'] = 'editChildcareProvider';
                        break;
                    case 'petcare':
                        attributeIdMap['petcareType'] = 'editPetcareType';
                        attributeIdMap['provider'] = 'editPetcareProvider';
                        break;
                    case 'savings':
                        attributeIdMap['savingsType'] = 'editSavingsType';
                        attributeIdMap['institution'] = 'editSavingsInstitution';
                        break;
                    case 'transportation':
                        attributeIdMap['transportType'] = 'editTransportationType';
                        attributeIdMap['provider'] = 'editTransportationProvider';
                        break;
                    case 'shopping':
                        attributeIdMap['shoppingType'] = 'editShoppingType';
                        attributeIdMap['store'] = 'editShoppingStore';
                        break;
                    case 'food':
                        attributeIdMap['diningType'] = 'editFoodType';
                        attributeIdMap['restaurant'] = 'editFoodRestaurant';
                        break;
                    case 'travel':
                        attributeIdMap['travelType'] = 'editTravelType';
                        attributeIdMap['destination'] = 'editTravelDestination';
                        break;
                }
            
            const inputId = attributeIdMap[attr.name];
            if (inputId) {
                const input = document.getElementById(inputId);
                if (input && input.value.trim()) {
                    attributes[attr.name] = input.value.trim();
                }
            }
        });
    }
    
    // Update the transaction
    transactions[transactionIndex] = {
        ...transactions[transactionIndex],
        name,
        amount: finalAmount,
        category,
        date,
        notes: notes.trim(),
        attributes: Object.keys(attributes).length > 0 ? attributes : null
    };
    
    // Save data and update UI
    saveData();
    updateDashboard();
    displayAllTransactions();
    closeModal('editTransactionModal');
    showNotification('Transaction updated successfully');
}

// Dashboard updates
function updateDashboard() {
    // Generate any due recurring transactions
    generateRecurringTransactions();
    
    // Update pending recurring transactions display
    updatePendingRecurringDisplay();
    
    // Get monthly transactions
    const monthlyTransactions = getMonthlyTransactions();
    
    // Calculate totals for current month
    const totalSpent = monthlyTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const totalIncome = monthlyTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const netBalance = totalIncome - totalSpent;
    const totalTransactions = monthlyTransactions.length;
    
    // Calculate additional statistics
    const expenses = monthlyTransactions.filter(t => t.amount < 0);
    const averageTransaction = expenses.length > 0 ? totalSpent / expenses.length : 0;
    
    // Most common category
    const categoryCount = {};
    expenses.forEach(transaction => {
        categoryCount[transaction.category] = (categoryCount[transaction.category] || 0) + 1;
    });
    const mostCommonCategory = Object.keys(categoryCount).reduce((a, b) => 
        categoryCount[a] > categoryCount[b] ? a : b, '');
    
    // Highest spending category
    const categorySpending = {};
    expenses.forEach(transaction => {
        categorySpending[transaction.category] = (categorySpending[transaction.category] || 0) + Math.abs(transaction.amount);
    });
    const highestSpendingCategory = Object.keys(categorySpending).reduce((a, b) => 
        categorySpending[a] > categorySpending[b] ? a : b, '');
    
    // Largest transaction
    const largestTransaction = expenses.length > 0 ? 
        expenses.reduce((max, transaction) => 
            Math.abs(transaction.amount) > Math.abs(max.amount) ? transaction : max
        ) : null;
    
    // Calculate total year spending
    const yearTransactions = transactions.filter(t => {
        const transactionDate = parseDate(t.date);
        return transactionDate && 
               transactionDate.getFullYear() === currentYear &&
               t.amount < 0 && // Only expenses
               t.status !== 'pending'; // Exclude pending transactions
    });
    const totalYearSpending = yearTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Update dashboard elements
    document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('netBalance').textContent = formatCurrency(netBalance);
    document.getElementById('totalTransactions').textContent = totalTransactions;
    document.getElementById('averageTransaction').textContent = formatCurrency(averageTransaction);
    document.getElementById('mostCommonCategory').textContent = mostCommonCategory ? getCategoryDisplayName(mostCommonCategory) : '-';
    document.getElementById('highestSpendingCategory').textContent = highestSpendingCategory ? getCategoryDisplayName(highestSpendingCategory) : '-';
    document.getElementById('largestTransaction').textContent = largestTransaction ? formatCurrency(Math.abs(largestTransaction.amount)) : '$0.00';
    document.getElementById('totalYearSpending').textContent = formatCurrency(totalYearSpending);
    
    // Update AI insights
    refreshInsights();
    
    updateRecentTransactions();
    updateCharts();
    updateBudgetProgressBars();
}

function updateRecentTransactions() {
    const recentList = document.getElementById('recentTransactionsList');
    const recent = transactions
        .filter(t => t.status !== 'pending') // Exclude pending transactions
        .slice(0, 5);
    
    if (recent.length === 0) {
        recentList.innerHTML = `
            <div class="empty-state">
                <h3>No transactions yet</h3>
                <p>Add your first transaction to get started!</p>
                <button class="btn-primary" onclick="openModal('addTransactionModal')">Add Transaction</button>
            </div>
        `;
        return;
    }
    
    recentList.innerHTML = recent.map(transaction => {
        const categoryAttrs = formatCategoryAttributes(transaction);
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-name">${transaction.name}</div>
                    <div class="transaction-category">${getCategoryDisplayName(transaction.category)}</div>
                    <div class="transaction-date">${formatDate(transaction.date)}</div>
                    ${categoryAttrs ? `<div class="transaction-attributes">${categoryAttrs}</div>` : ''}
                </div>
                <div class="transaction-amount ${transaction.amount < 0 ? 'expense' : 'income'}">
                    ${formatCurrency(Math.abs(transaction.amount))}
                </div>
            </div>
        `;
    }).join('');
}

function displayAllTransactions() {
    const allList = document.getElementById('allTransactionsList');
    
    const confirmedTransactions = transactions.filter(t => t.status !== 'pending');
    
    if (confirmedTransactions.length === 0) {
        allList.innerHTML = `
            <div class="empty-state">
                <h3>No transactions yet</h3>
                <p>Add your first transaction to get started!</p>
                <button class="btn-primary" onclick="openModal('addTransactionModal')">Add Transaction</button>
            </div>
        `;
        return;
    }
    
    allList.innerHTML = confirmedTransactions.map(transaction => {
        const categoryAttrs = formatCategoryAttributes(transaction);
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-name">${transaction.name}</div>
                    <div class="transaction-category">${getCategoryDisplayName(transaction.category)}</div>
                    <div class="transaction-date">${formatDate(transaction.date)}</div>
                    ${categoryAttrs ? `<div class="transaction-attributes">${categoryAttrs}</div>` : ''}
                    ${transaction.notes ? `<div class="transaction-notes">${transaction.notes}</div>` : ''}
                </div>
                <div class="transaction-amount ${transaction.amount < 0 ? 'expense' : 'income'}">
                    ${formatCurrency(Math.abs(transaction.amount))}
                </div>
                <div class="transaction-actions">
                    <button class="btn-edit" onclick="editTransaction(${transaction.id})">Edit</button>
                    <button class="btn-delete" onclick="deleteTransaction(${transaction.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Filter functionality
function applyFilters() {
    const filterStartDate = document.getElementById('filterStartDate').value;
    const filterEndDate = document.getElementById('filterEndDate').value;
    const filterCategory = document.getElementById('filterCategory').value;
    
    let filteredTransactions = transactions.filter(t => t.status !== 'pending'); // Exclude pending transactions
    
    // Filter by date range
    if (filterStartDate || filterEndDate) {
        filteredTransactions = filteredTransactions.filter(transaction => {
            const transactionDate = parseDate(transaction.date);
            if (!transactionDate) return false;
            
            const startDate = filterStartDate ? parseDate(filterStartDate) : null;
            const endDate = filterEndDate ? parseDate(filterEndDate) : null;
            
            // If only start date is provided, show transactions from that date onwards
            if (startDate && !endDate) {
                return transactionDate >= startDate;
            }
            // If only end date is provided, show transactions up to that date
            else if (!startDate && endDate) {
                return transactionDate <= endDate;
            }
            // If both dates are provided, show transactions within the range
            else if (startDate && endDate) {
                return transactionDate >= startDate && transactionDate <= endDate;
            }
            
            return true;
        });
    }
    
    if (filterCategory) {
        filteredTransactions = filteredTransactions.filter(transaction => 
            transaction.category === filterCategory
        );
    }
    
    displayFilteredTransactions(filteredTransactions);
}

function clearFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterCategory').value = '';
    displayAllTransactions();
}

function displayFilteredTransactions(filteredTransactions) {
    const allList = document.getElementById('allTransactionsList');
    
    if (filteredTransactions.length === 0) {
        allList.innerHTML = `
            <div class="empty-state">
                <h3>No transactions found</h3>
                <p>Try adjusting your search terms.</p>
            </div>
        `;
        return;
    }
    
    allList.innerHTML = filteredTransactions.map(transaction => {
        const categoryAttrs = formatCategoryAttributes(transaction);
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-name">${transaction.name}</div>
                    <div class="transaction-category">${transaction.category}</div>
                    <div class="transaction-date">${formatDate(transaction.date)}</div>
                    ${categoryAttrs ? `<div class="transaction-attributes">${categoryAttrs}</div>` : ''}
                    ${transaction.notes ? `<div class="transaction-notes">${transaction.notes}</div>` : ''}
                </div>
                <div class="transaction-amount ${transaction.amount < 0 ? 'expense' : 'income'}">
                    ${formatCurrency(Math.abs(transaction.amount))}
                </div>
                <div class="transaction-actions">
                    <button class="btn-edit" onclick="editTransaction(${transaction.id})">Edit</button>
                    <button class="btn-delete" onclick="deleteTransaction(${transaction.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Charts
function getThemeColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const computedStyle = getComputedStyle(document.documentElement);
    
    if (isLight) {
        return {
            categoryColors: [
                '#1e40af', '#dc2626', '#059669', '#d97706',
                '#7c3aed', '#0891b2', '#65a30d', '#ea580c',
                '#be185d', '#0d9488', '#e11d48', '#9333ea'
            ],
            barColor: '#1e40af',
            barBorderColor: '#1e3a8a',
            gridColor: 'rgba(3, 105, 161, 0.1)',
            textColor: computedStyle.getPropertyValue('--text-primary').trim()
        };
    } else {
        return {
            categoryColors: [
                '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
                '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
                '#ec4899', '#14b8a6', '#f43f5e', '#a855f7'
            ],
            barColor: '#3b82f6',
            barBorderColor: '#1d4ed8',
            gridColor: 'rgba(255, 255, 255, 0.1)',
            textColor: computedStyle.getPropertyValue('--text-primary').trim()
        };
    }
}

function initializeCharts() {
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        return;
    }
    
    const themeColors = getThemeColors();
    
    // Category Chart (Pie Chart)
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx && categoryCtx.getContext) {
        // Destroy existing chart if it exists
        if (categoryChart) {
            categoryChart.destroy();
        }
        
        categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: themeColors.categoryColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            color: themeColors.textColor,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    } else {
        console.warn('Category chart canvas not found');
    }
    
    // Daily Expenses Chart (Stacked Bar Chart)
    const dailyExpensesCtx = document.getElementById('dailyExpensesChart');
    if (dailyExpensesCtx && dailyExpensesCtx.getContext) {
        // Destroy existing chart if it exists
        if (dailyExpensesChart) {
            dailyExpensesChart.destroy();
        }
        
        dailyExpensesChart = new Chart(dailyExpensesCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Daily Expenses',
                    data: [],
                    backgroundColor: themeColors.barColor,
                    borderColor: themeColors.barBorderColor,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            },
                            color: themeColors.textColor,
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            color: themeColors.gridColor
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Day of Month',
                            color: themeColors.textColor,
                            font: {
                                size: 12
                            },
                            padding: {
                                bottom: 30
                            }
                        },
                        ticks: {
                            padding: 5,
                            color: themeColors.textColor,
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            color: themeColors.gridColor
                        }
                    }
                },
                layout: {
                    padding: {
                        bottom: 20
                    }
                }
            }
        });
    } else {
        console.warn('Daily expenses chart canvas not found');
    }
}

function updateChartColors() {
    // Force complete chart re-initialization to update all colors including labels
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }
    if (dailyExpensesChart) {
        dailyExpensesChart.destroy();
        dailyExpensesChart = null;
    }
    
    // Re-initialize charts with new theme colors
    initializeCharts();
    
    // Update chart data
    updateCharts();
}

function updateCharts() {
    // Ensure charts are initialized
    if (!categoryChart || !dailyExpensesChart) {
        console.log('Charts not initialized, initializing now...');
        initializeCharts();
    }
    
    const monthlyTransactions = getMonthlyTransactions();
    
    // Update category chart (pie chart)
    const categoryData = {};
    monthlyTransactions.filter(t => t.amount < 0).forEach(t => {
        categoryData[t.category] = (categoryData[t.category] || 0) + Math.abs(t.amount);
    });
    
    if (categoryChart) {
        categoryChart.data.labels = Object.keys(categoryData).map(cat => getCategoryDisplayName(cat));
        categoryChart.data.datasets[0].data = Object.values(categoryData);
        categoryChart.update();
    }
    
    // Update daily expenses chart (stacked bar chart)
    const dailyData = {};
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Initialize all days with 0
    for (let day = 1; day <= daysInMonth; day++) {
        dailyData[day] = 0;
    }
    
    // Add actual spending data
    monthlyTransactions.filter(t => t.amount < 0).forEach(t => {
        const day = parseDate(t.date).getDate();
        dailyData[day] += Math.abs(t.amount);
    });
    
    if (dailyExpensesChart) {
        dailyExpensesChart.data.labels = Object.keys(dailyData);
        dailyExpensesChart.data.datasets[0].data = Object.values(dailyData);
        dailyExpensesChart.update();
    }
}

// Analytics




// Settings
function saveBudgetSettings() {
    if (!currentUser) {
        showNotification('Please login to save settings', 'error');
        return;
    }
    
    // Budget values are already saved in updateBudgetSummary()
    updateBudgetSummary();
    updateDashboard();
    updateBudgetProgressBars();
    showNotification('Budget settings saved successfully!');
}

function savePreferences() {
    if (!currentUser) {
        showNotification('Please login to save settings', 'error');
        return;
    }
    
    settings.currency = document.getElementById('currencySelect').value;
    settings.notifications = document.getElementById('notificationsEnabled').checked;
    settings.autoCategorize = document.getElementById('autoCategorize').checked;
    
    saveData();
    updateDashboard();
    updateBudgetProgressBars();
    showNotification('Preferences saved successfully!');
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: settings.currency
    }).format(amount);
}

function formatDate(dateString) {
    const date = parseDate(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString();
    }
}

function showNotification(message, type = 'success') {
    console.log('=== showNotification called ===');
    console.log('Message:', message);
    console.log('Type:', type);
    
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    console.log('Notification element:', notification);
    console.log('Notification text element:', notificationText);
    
    if (!notification || !notificationText) {
        console.error('Notification elements not found!');
        return;
    }
    
    notificationText.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    console.log('Notification shown with class:', notification.className);
    
    setTimeout(() => {
        notification.classList.remove('show');
        console.log('Notification hidden');
    }, 3000);
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Close modals with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }
});

// Authentication functions
function checkAuthStatus() {
    if (currentUser) {
        showAuthenticatedUI();
    } else {
        showUnauthenticatedUI();
    }
}

function showAuthenticatedUI() {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('user-menu').style.display = 'flex';
    document.getElementById('user-email').textContent = currentUser.email;
    
    // Enable all app functionality
    document.querySelectorAll('.nav-link').forEach(link => link.style.pointerEvents = 'auto');
}

function showUnauthenticatedUI() {
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
    
    // Disable app functionality for unauthenticated users
    document.querySelectorAll('.nav-link').forEach(link => link.style.pointerEvents = 'none');
    
    // Show login prompt
    document.querySelector('.main-content').innerHTML = `
        <div class="container" style="text-align: center; padding-top: 4rem;">
            <div style="max-width: 500px; margin: 0 auto;">
                <h1 style="font-size: 3rem; margin-bottom: 1rem;">💰</h1>
                        <h2 style="font-size: 2rem; margin-bottom: 1rem; color: var(--text-primary);">Welcome to FinanceTracker</h2>
        <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 2rem;">
                    Track your finances, analyze spending patterns, and achieve your financial goals.
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn-primary" onclick="openModal('loginModal')">Login</button>
                    <button class="btn-secondary" onclick="openModal('registerModal')">Register</button>
                </div>
            </div>
        </div>
    `;
}

function handleLoginClick() {
    console.log('=== handleLoginClick function called ===');
    console.log('Button clicked at:', new Date().toISOString());
    
    // Get form values
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    console.log('Login attempt:', { email, password });
    console.log('Available users:', users);
    
    // Validate form
    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    const user = users.find(u => u.email === email && u.password === password);
    console.log('Found user:', user);
    
    if (user) {
        currentUser = user;
        saveData();
        closeModal('loginModal');
        showAuthenticatedUI();
        loadUserData();
        updateDashboard();
        showNotification('Login successful! Please refresh the page to access your dashboard.', 'success');
        alert('Login successful! Please refresh the page to access your dashboard.');
        console.log('=== Login successful ===');
        
        // Don't auto-refresh, let user manually refresh
        console.log('Waiting for user to refresh page...');
    } else {
        showNotification('Invalid email or password', 'error');
        console.log('=== Login failed - invalid credentials ===');
    }
}

function handleLogin(e) {
    console.log('=== handleLogin function called ===');
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    console.log('Login attempt:', { email, password });
    console.log('Available users:', users);
    
    const user = users.find(u => u.email === email && u.password === password);
    console.log('Found user:', user);
    
    if (user) {
        currentUser = user;
        saveData();
        closeModal('loginModal');
        showAuthenticatedUI();
        loadUserData();
        updateDashboard();
        showNotification('Login successful!');
        console.log('=== Login successful ===');
        
        // Automatically navigate to dashboard after login
        setTimeout(() => {
            showSection('dashboard');
        }, 100);
    } else {
        showNotification('Invalid email or password', 'error');
        console.log('=== Login failed - invalid credentials ===');
    }
}

function handleRegisterClick() {
    console.log('=== handleRegisterClick function called ===');
    console.log('Button clicked at:', new Date().toISOString());
    
    // Get form values
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    console.log('Registration attempt:', { email, password, confirmPassword });
    console.log('Current users before registration:', users);
    
    // Validate form
    if (!email || !password || !confirmPassword) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        console.log('=== Registration failed - passwords do not match ===');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        console.log('=== Registration failed - password too short ===');
        return;
    }
    
    if (users.find(u => u.email === email)) {
        showNotification('User with this email already exists', 'error');
        console.log('=== Registration failed - user already exists ===');
        return;
    }
    
    const newUser = {
        id: Date.now(),
        email: email,
        password: password,
        createdAt: new Date().toISOString()
    };
    
    console.log('Creating new user:', newUser);
    
        users.push(newUser);
    currentUser = newUser;
    saveData();
    closeModal('registerModal');
    showAuthenticatedUI();
    showNotification('Registration successful! Please refresh the page to access your settings.', 'success');
    alert('Registration successful! Please refresh the page to access your settings.');
    
    console.log('Users after registration:', users);
    console.log('=== Registration successful ===');
    
    // Don't auto-refresh, let user manually refresh
    console.log('Waiting for user to refresh page...');
}

function handleRegister(e) {
    console.log('=== handleRegister function called ===');
    e.preventDefault();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    console.log('Registration attempt:', { email, password, confirmPassword });
    console.log('Current users before registration:', users);
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        console.log('=== Registration failed - passwords do not match ===');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        console.log('=== Registration failed - password too short ===');
        return;
    }
    
    if (users.find(u => u.email === email)) {
        showNotification('User with this email already exists', 'error');
        console.log('=== Registration failed - user already exists ===');
        return;
    }
    
    const newUser = {
        id: Date.now(),
        email: email,
        password: password,
        createdAt: new Date().toISOString()
    };
    
    console.log('Creating new user:', newUser);
    
    users.push(newUser);
    currentUser = newUser;
    saveData();
    closeModal('registerModal');
    showAuthenticatedUI();
    showOnboardingWizard();
    showNotification('Registration successful!');
    
    console.log('Users after registration:', users);
    console.log('=== Registration successful ===');
    
    // Automatically navigate to settings after registration
    setTimeout(() => {
        showSection('settings');
    }, 100);
}

function logout() {
    // Clear chat history when logging out
    chatHistory = [];
    saveChatHistory();
    
    currentUser = null;
    saveData();
    showUnauthenticatedUI();
    showNotification('Logged out successfully');
}

function switchToRegister() {
    closeModal('loginModal');
    openModal('registerModal');
}

function switchToLogin() {
    closeModal('registerModal');
    openModal('loginModal');
}

function loadUserData() {
    // Load user-specific data
    const userTransactions = localStorage.getItem(`transactions_${currentUser.id}`);
    const userSettings = localStorage.getItem(`settings_${currentUser.id}`);
    
    if (userTransactions) {
        transactions = JSON.parse(userTransactions);
    } else {
        transactions = [];
    }
    
    if (userSettings) {
        settings = { ...settings, ...JSON.parse(userSettings) };
    }
    
    // Ensure selectedCategories is initialized
    if (!settings.selectedCategories) {
        settings.selectedCategories = [];
        console.log('Initializing empty selectedCategories array');
    }
    
    console.log('Loaded user settings:', settings);
    console.log('Selected categories:', settings.selectedCategories);
    
    // Update UI with user data
    if (document.getElementById('currencySelect')) {
        document.getElementById('currencySelect').value = settings.currency;
    }
    if (document.getElementById('notificationsEnabled')) {
        document.getElementById('notificationsEnabled').checked = settings.notifications;
    }
    if (document.getElementById('autoCategorize')) {
        document.getElementById('autoCategorize').checked = settings.autoCategorize;
    }
    
    // Initialize budget management for new budget system
    if (document.getElementById('categoryCards')) {
        initializeBudgetManagement();
    }
    
    // Ensure all transaction IDs are integers to prevent "transaction not found" errors
    if (transactions && transactions.length > 0) {
        transactions.forEach(transaction => {
            if (transaction.id) {
                transaction.id = parseInt(transaction.id);
            }
        });
    }
    
    // Load dashboard settings
    const savedDashboardStats = localStorage.getItem(`dashboardStats_${currentUser.id}`);
    if (savedDashboardStats) {
        dashboardStats = { ...dashboardStats, ...JSON.parse(savedDashboardStats) };
    }
    
    // Update transaction categories to only show selected categories
    updateTransactionCategories();
    
    // Chat history will be loaded when the financial-questions section is shown
}

function saveUserData() {
    localStorage.setItem(`transactions_${currentUser.id}`, JSON.stringify(transactions));
    localStorage.setItem(`settings_${currentUser.id}`, JSON.stringify(settings));
    localStorage.setItem(`dashboardStats_${currentUser.id}`, JSON.stringify(dashboardStats));
    saveChatHistory(); // Save chat history when user data is saved
}



// Budget Management Functions
function initializeBudgetManagement() {
    loadSelectedCategories();
    
    // Set budget type radio button based on saved setting
    if (settings.budgetType) {
        const radioButton = document.querySelector(`input[name="budgetType"][value="${settings.budgetType}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }
    }
    
    // Set initial state of total budget input
    const budgetType = settings.budgetType || document.querySelector('input[name="budgetType"]:checked')?.value || 'dollar';
    const totalBudgetInput = document.getElementById('totalBudgetInput');
    const totalBudgetField = document.getElementById('totalBudgetField');
    
    // Only proceed if the elements exist (we're on the settings page)
    if (totalBudgetInput && totalBudgetField) {
        if (budgetType === 'dollar') {
            totalBudgetInput.style.display = 'block';
            // Load saved total budget value
            if (settings.totalBudget) {
                totalBudgetField.value = settings.totalBudget;
            }
        } else {
            totalBudgetInput.style.display = 'none';
        }
    }
    
    generateBudgetInputs();
    updateBudgetSummary();
    updateBudgetProgressBars();
}

function toggleCategory(card) {
    const category = card.dataset.category;
    const isSelected = card.classList.contains('selected');
    
    if (isSelected) {
        card.classList.remove('selected');
        card.classList.add('deselected');
        removeCategoryFromSettings(category);
    } else {
        card.classList.remove('deselected');
        card.classList.add('selected');
        addCategoryToSettings(category);
    }
    
    generateBudgetInputs();
    updateBudgetSummary();
    updateTransactionCategories();
    updateDashboard();
    updateBudgetProgressBars();
}

function addCategoryToSettings(category) {
    if (!settings.selectedCategories) {
        settings.selectedCategories = [];
    }
    if (!settings.selectedCategories.includes(category)) {
        settings.selectedCategories.push(category);
    }
    saveData();
    updateDashboard();
    updateBudgetProgressBars();
    updateTransactionCategories();
}

function removeCategoryFromSettings(category) {
    if (settings.selectedCategories) {
        settings.selectedCategories = settings.selectedCategories.filter(c => c !== category);
        // Remove budget for this category
        if (settings.budgets && settings.budgets[category]) {
            delete settings.budgets[category];
        }
    }
    saveData();
    updateDashboard();
    updateBudgetProgressBars();
    updateTransactionCategories();
}

function loadSelectedCategories() {
    if (!settings.selectedCategories) {
        // Default categories
        settings.selectedCategories = ['food', 'transportation', 'entertainment', 'shopping', 'bills', 'groceries'];
    }
    
    // Update category cards
    document.querySelectorAll('.category-card').forEach(card => {
        const category = card.dataset.category;
        if (settings.selectedCategories.includes(category)) {
            card.classList.add('selected');
            card.classList.remove('deselected');
        } else {
            card.classList.add('deselected');
            card.classList.remove('selected');
        }
    });
}

function generateBudgetInputs() {
    const budgetSettings = document.getElementById('budgetSettings');
    
    // Check if we're on the settings page
    if (!budgetSettings) {
        console.log('Budget settings element not found, skipping budget inputs generation');
        return;
    }
    
    const budgetType = settings.budgetType || document.querySelector('input[name="budgetType"]:checked')?.value || 'dollar';
    
    if (!settings.selectedCategories || settings.selectedCategories.length === 0) {
        budgetSettings.innerHTML = '<p>Please select at least one category first.</p>';
        return;
    }
    
    // Initialize budget values storage if not exists
    if (!settings.budgetValues) {
        settings.budgetValues = { dollar: {}, percentage: {} };
    }
    
    let html = '';
    settings.selectedCategories.forEach(category => {
        const categoryName = getCategoryDisplayName(category);
        
        // Get the value for the current budget type, or from the other type if current is empty
        let currentValue = settings.budgetValues[budgetType][category] || '';
        if (!currentValue && settings.budgetValues[budgetType === 'dollar' ? 'percentage' : 'dollar'][category]) {
            // If current type is empty but other type has a value, use the other type's value
            currentValue = settings.budgetValues[budgetType === 'dollar' ? 'percentage' : 'dollar'][category];
        }
        
        const suffix = budgetType === 'percentage' ? '%' : getCurrencySymbol();
        
        html += `
            <div class="dynamic-budget-item">
                <label>${categoryName}</label>
                <div style="display: flex; align-items: center;">
                    <input type="number" 
                           id="budget_${category}" 
                           value="${currentValue}" 
                           step="${budgetType === 'percentage' ? '1' : '0.01'}"
                           min="0"
                           max="${budgetType === 'percentage' ? '100' : ''}"
                           onchange="saveBudgetValue('${category}', this.value)"
                           oninput="updateBudgetSummary()">
                    <span class="budget-suffix">${suffix}</span>
                </div>
            </div>
        `;
    });
    
    budgetSettings.innerHTML = html;
}

function getCategoryDisplayName(category) {
    const names = {
        'bills': 'Bills',
        'entertainment': 'Entertainment',
        'healthcare': 'Healthcare',
        'groceries': 'Groceries',
        'education': 'Education',
        'gifts': 'Gifts & Donations',
        'personal-care': 'Personal Care',
        'home-maintenance': 'Home Maintenance',
        'childcare': 'Childcare',
        'petcare': 'Petcare',
        'savings': 'Savings/Investments',
        'transportation': 'Transportation',
        'shopping': 'Shopping',
        'food': 'Food & Dining',
        'travel': 'Travel',
        'other': 'Other',
        'income': 'Income'
    };
    return names[category] || category;
}

function getCurrencySymbol() {
    const symbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'CAD': 'C$',
        'AUD': 'A$'
    };
    return symbols[settings.currency] || '$';
}

function toggleBudgetType() {
    const budgetType = document.querySelector('input[name="budgetType"]:checked').value;
    const totalBudgetInput = document.getElementById('totalBudgetInput');
    
    // Save budget type to settings
    settings.budgetType = budgetType;
    saveData();
    
    // Show/hide total budget input based on budget type
    if (budgetType === 'dollar') {
        totalBudgetInput.style.display = 'block';
    } else {
        totalBudgetInput.style.display = 'none';
    }
    
    generateBudgetInputs();
    updateBudgetSummary();
    updateDashboard();
    updateBudgetProgressBars();
}

function saveBudgetValue(category, value) {
    const budgetType = settings.budgetType || document.querySelector('input[name="budgetType"]:checked')?.value || 'dollar';
    
    // Initialize budget values storage if not exists
    if (!settings.budgetValues) {
        settings.budgetValues = { dollar: {}, percentage: {} };
    }
    
    // Save the value for the current budget type
    settings.budgetValues[budgetType][category] = value;
    
    // Also update the budgets object for backward compatibility
    if (!settings.budgets) {
        settings.budgets = {};
    }
    settings.budgets[category] = value;
    
    saveData();
    updateBudgetSummary();
    updateDashboard();
    updateBudgetProgressBars();
}

function updateBudgetSummary() {
    const budgetType = settings.budgetType || document.querySelector('input[name="budgetType"]:checked')?.value || 'dollar';
    const totalBudgetLabel = document.getElementById('totalBudgetLabel');
    const totalBudgetAmount = document.getElementById('totalBudgetAmount');
    const remainingBudgetLabel = document.getElementById('remainingBudgetLabel');
    const remainingBudgetAmount = document.getElementById('remainingBudgetAmount');
    const totalBudgetField = document.getElementById('totalBudgetField');
    
    // Check if we're on the settings page
    if (!totalBudgetLabel || !totalBudgetAmount || !remainingBudgetLabel || !remainingBudgetAmount) {
        console.log('Budget summary elements not found, skipping budget summary update');
        return;
    }
    
    let total = 0;
    let allocated = 0;
    
    if (settings.selectedCategories) {
        settings.selectedCategories.forEach(category => {
            // Use the budget values storage for the current budget type
            const value = parseFloat(settings.budgetValues?.[budgetType]?.[category] || 0);
            allocated += value;
            
            // Also update the budgets object for backward compatibility
            if (!settings.budgets) settings.budgets = {};
            settings.budgets[category] = value;
        });
    }
    
    if (budgetType === 'percentage') {
        total = 100;
        totalBudgetLabel.textContent = 'Total Percentage:';
        remainingBudgetLabel.textContent = 'Remaining:';
        totalBudgetAmount.textContent = '100%';
        remainingBudgetAmount.textContent = `${Math.max(0, total - allocated)}%`;
        
        if (allocated > 100) {
            remainingBudgetAmount.style.color = '#ef4444';
        } else {
            remainingBudgetAmount.style.color = '#1e293b';
        }
    } else {
        // Use the total budget input value for dollar amounts
        total = parseFloat(totalBudgetField.value) || 0;
        totalBudgetLabel.textContent = 'Total Budget:';
        remainingBudgetLabel.textContent = 'Remaining:';
        totalBudgetAmount.textContent = formatCurrency(total);
        remainingBudgetAmount.textContent = formatCurrency(Math.max(0, total - allocated));
        
        // Save total budget to settings
        if (!settings.totalBudget) settings.totalBudget = {};
        settings.totalBudget = total;
        
        // Color coding for remaining budget
        if (allocated > total) {
            remainingBudgetAmount.style.color = '#ef4444';
        } else if (allocated > total * 0.8) {
            remainingBudgetAmount.style.color = '#f59e0b';
        } else {
            remainingBudgetAmount.style.color = '#1e293b';
        }
    }
    
    saveData();
    updateBudgetProgressBars();
}

function updateCurrencyDisplay() {
    const currency = document.getElementById('currencySelect').value;
    settings.currency = currency;
    saveData();
    
    // Update all currency displays
    updateDashboard();
    updateBudgetSummary();
    generateBudgetInputs();
}

function updateBudgetProgressBars() {
    const container = document.getElementById('budgetProgressContainer');
    const budgetType = settings.budgetType || document.querySelector('input[name="budgetType"]:checked')?.value || 'dollar';
    
    console.log('updateBudgetProgressBars - budgetType:', budgetType, 'settings.budgetType:', settings.budgetType);
    
    // Check if we're on the dashboard page
    if (!container) {
        console.log('Budget progress container not found, skipping budget progress update');
        return;
    }
    
    if (!settings.selectedCategories || settings.selectedCategories.length === 0) {
        container.innerHTML = '<p>No budget categories selected. Go to Settings to configure your budget.</p>';
        return;
    }
    
    // Get selected month's transactions (using global currentMonth and currentYear)
    const monthlyTransactions = transactions.filter(t => {
        const transactionDate = parseDate(t.date);
        return transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear &&
               t.amount < 0 && // Only expenses
               t.status !== 'pending'; // Exclude pending transactions
    });
    
    const totalMonthlySpending = monthlyTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    let html = '';
    settings.selectedCategories.forEach(category => {
        const categoryName = getCategoryDisplayName(category);
        const budget = settings.budgetValues?.[budgetType]?.[category] || 0;
        
        if (budget > 0) {
            const spent = monthlyTransactions
                .filter(t => t.category === category)
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);
            
            let percentage, progressClass, displayText;
            
            if (budgetType === 'percentage') {
                // For percentage-based budgeting, show spending as percentage of total monthly spending
                if (totalMonthlySpending > 0) {
                    const spendingPercentage = (spent / totalMonthlySpending) * 100;
                    // Progress bar shows spending percentage relative to allocated percentage
                    percentage = Math.min((spendingPercentage / budget) * 100, 100);
                    displayText = `${spendingPercentage.toFixed(1)}% / ${budget}%`;
                } else {
                    percentage = 0;
                    displayText = `0% / ${budget}%`;
                }
            } else {
                // For dollar-based budgeting, show spending as percentage of budget
                percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                displayText = `${formatCurrency(spent)} / ${formatCurrency(budget)}`;
            }
            
            // Determine progress bar color
            if (percentage >= 100) {
                progressClass = 'over';
            } else if (percentage >= 80) {
                progressClass = 'warning';
            }
            
            html += `
                <div class="budget-progress-item">
                    <div class="budget-progress-header">
                        <span class="budget-progress-label">${categoryName}</span>
                        <span class="budget-progress-amount">${displayText}</span>
                    </div>
                    <div class="budget-progress-bar">
                        <div class="budget-progress-fill ${progressClass}" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }
    });
    
    if (html === '') {
        html = '<p>No budgets configured. Go to Settings to set up your budget limits.</p>';
    }
    
    container.innerHTML = html;
}

function updateTransactionCategories() {
    console.log('updateTransactionCategories called');
    console.log('Current settings:', settings);
    console.log('Selected categories:', settings.selectedCategories);
    
    // Update transaction form categories
    const transactionCategory = document.getElementById('transactionCategory');
    const editTransactionCategory = document.getElementById('editTransactionCategory');
    const filterCategory = document.getElementById('filterCategory');
    
    console.log('Found elements:', {
        transactionCategory: !!transactionCategory,
        editTransactionCategory: !!editTransactionCategory,
        filterCategory: !!filterCategory
    });
    
    if (transactionCategory) {
        updateCategorySelect(transactionCategory);
    }
    if (editTransactionCategory) {
        updateCategorySelect(editTransactionCategory);
    }
    if (filterCategory) {
        updateCategorySelect(filterCategory);
    }
}

function updateCategorySelect(selectElement) {
    const currentValue = selectElement.value;
    let html = '<option value="">Select Category</option>';
    
    console.log('Updating category select:', selectElement.id);
    console.log('Settings selected categories:', settings.selectedCategories);
    
    // Only show selected categories, no fallback
    if (settings.selectedCategories && settings.selectedCategories.length > 0) {
        settings.selectedCategories.forEach(category => {
            const categoryName = getCategoryDisplayName(category);
            const selected = category === currentValue ? 'selected' : '';
            html += `<option value="${category}" ${selected}>${categoryName}</option>`;
        });
    } else {
        console.log('No selected categories found, showing empty dropdown');
        // Don't show any categories if none are selected
    }
    
    selectElement.innerHTML = html;
}

// Recurring Transaction Functions
function toggleRecurringSettings() {
    const isRecurring = document.getElementById('isRecurring').checked;
    const recurringSettings = document.getElementById('recurringSettings');
    const frequencySelect = document.getElementById('recurringFrequency');
    
    if (isRecurring) {
        recurringSettings.style.display = 'block';
        frequencySelect.required = true;
    } else {
        recurringSettings.style.display = 'none';
        frequencySelect.required = false;
    }
}

function handleRecurringFrequencyChange() {
    const frequency = document.getElementById('recurringFrequency').value;
    const customDatesContainer = document.getElementById('customDatesContainer');
    
    if (frequency === 'custom') {
        customDatesContainer.style.display = 'block';
    } else {
        customDatesContainer.style.display = 'none';
    }
}

function generateRecurringTransactions() {
    const currentDate = new Date();
    const recurringTransactions = settings.recurringTransactions || [];
    
    recurringTransactions.forEach(recurring => {
        const nextDueDate = parseDate(recurring.nextDueDate);
        
        // Check if transaction is due today or overdue
        if (nextDueDate <= currentDate) {
            // Check if we already have a pending transaction for this recurring
            const existingPending = transactions.find(t => 
                t.recurringId === recurring.id && 
                t.status === 'pending' && 
                parseDate(t.date).toDateString() === nextDueDate.toDateString()
            );
            
            if (!existingPending) {
                // Create pending transaction
                const pendingTransaction = {
                    id: Date.now() + Math.random(),
                    name: recurring.name,
                    amount: recurring.amount,
                    type: recurring.type,
                    category: recurring.category,
                    date: nextDueDate.toISOString().split('T')[0],
                    notes: recurring.notes,
                    attributes: recurring.attributes,
                    status: 'pending',
                    recurringId: recurring.id,
                    autoConfirm: recurring.autoConfirm
                };
                
                transactions.push(pendingTransaction);
                
                // Auto-confirm if enabled
                if (recurring.autoConfirm) {
                    pendingTransaction.status = 'confirmed';
                    pendingTransaction.date = new Date().toISOString().split('T')[0];
                }
                
                // Calculate next due date
                const nextDate = calculateNextDueDate(recurring, nextDueDate);
                if (nextDate) {
                    recurring.nextDueDate = nextDate.toISOString().split('T')[0];
                } else {
                    // Remove recurring transaction if it has ended
                    const recurringIndex = settings.recurringTransactions.findIndex(r => r.id === recurring.id);
                    if (recurringIndex !== -1) {
                        settings.recurringTransactions.splice(recurringIndex, 1);
                    }
                }
            }
        }
    });
    
    saveData();
}

function calculateNextDueDate(recurring, currentDueDate) {
    const nextDate = new Date(currentDueDate.getTime());
    
    switch (recurring.frequency) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'biweekly':
            nextDate.setDate(nextDate.getDate() + 14);
            break;
        case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        case 'custom':
            // For custom dates, we need to find the next date in the sequence
            const customDates = recurring.customDates || [];
            const currentMonth = nextDate.getMonth();
            const currentDay = nextDate.getDate();
            
            // Find next date in current year
            let nextCustomDate = customDates.find(date => {
                const [month, day] = date.split('-').map(Number);
                return (month > currentMonth) || (month === currentMonth && day > currentDay);
            });
            
            if (!nextCustomDate) {
                // If no more dates this year, get first date of next year
                nextCustomDate = customDates[0];
                nextDate.setFullYear(nextDate.getFullYear() + 1);
            }
            
            const [nextMonth, nextDay] = nextCustomDate.split('-').map(Number);
            nextDate.setMonth(nextMonth - 1); // Month is 0-indexed
            nextDate.setDate(nextDay);
            break;
    }
    
    // Check if we've passed the end date
    if (recurring.endDate) {
        const endDate = parseDate(recurring.endDate);
        if (nextDate > endDate) {
            return null; // Recurring transaction has ended
        }
    }
    
    return nextDate;
}

function confirmPendingTransaction(transactionId) {
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction && transaction.status === 'pending') {
        transaction.status = 'confirmed';
        transaction.date = new Date().toISOString().split('T')[0];
        saveData();
        updateDashboard();
        showNotification('Transaction confirmed successfully!');
    }
}

function deletePendingTransaction(transactionId) {
    const transactionIndex = transactions.findIndex(t => t.id === transactionId);
    if (transactionIndex !== -1 && transactions[transactionIndex].status === 'pending') {
        transactions.splice(transactionIndex, 1);
        saveData();
        updateDashboard();
        showNotification('Pending transaction deleted successfully!');
    }
}

function updatePendingRecurringDisplay() {
    const pendingSection = document.getElementById('pendingRecurringSection');
    const pendingList = document.getElementById('pendingRecurringList');
    const pendingModalList = document.getElementById('pendingRecurringModalList');
    
    const pendingTransactions = transactions.filter(t => t.status === 'pending');
    
    if (pendingTransactions.length > 0) {
        pendingSection.style.display = 'block';
        
        // Update dashboard pending list (show first 3)
        const dashboardPending = pendingTransactions.slice(0, 3);
        pendingList.innerHTML = dashboardPending.map(transaction => 
            createPendingTransactionHTML(transaction)
        ).join('');
        
        // Update modal pending list (show all)
        pendingModalList.innerHTML = pendingTransactions.map(transaction => 
            createPendingTransactionHTML(transaction)
        ).join('');
    } else {
        pendingSection.style.display = 'none';
    }
}

function createPendingTransactionHTML(transaction) {
    const amountClass = transaction.type === 'expense' ? 'expense' : 'income';
    const amountPrefix = transaction.type === 'expense' ? '-' : '+';
    
    return `
        <div class="pending-item">
            <div class="pending-info">
                <div class="pending-title">${transaction.name}</div>
                <div class="pending-details">
                    ${getCategoryDisplayName(transaction.category)} • ${formatDate(transaction.date)}
                    ${transaction.notes ? ` • ${transaction.notes}` : ''}
                </div>
            </div>
            <div class="pending-amount ${amountClass}">
                ${amountPrefix}${formatCurrency(Math.abs(transaction.amount))}
            </div>
            <div class="pending-actions">
                <button class="btn-confirm" onclick="confirmPendingTransaction(${transaction.id})">
                    Confirm
                </button>
                <button class="btn-delete" onclick="deletePendingTransaction(${transaction.id})">
                    Delete
                </button>
            </div>
        </div>
    `;
}

// Modify existing functions to handle recurring transactions
function resetTransactionForm() {
    document.getElementById('transactionForm').reset();
    document.getElementById('categoryAttributes').style.display = 'none';
    document.getElementById('recurringSettings').style.display = 'none';
    document.getElementById('customDatesContainer').style.display = 'none';
    document.getElementById('recurringFrequency').required = false;
    
    // Reset category field visibility
    const categoryFormGroup = document.getElementById('categoryFormGroup');
    const categorySelect = document.getElementById('transactionCategory');
    if (categoryFormGroup && categorySelect) {
        categoryFormGroup.style.display = 'block';
        categorySelect.setAttribute('required', 'required');
    }
    
    setDefaultDate();
}

// Month Navigation Functions
function changeMonth(direction) {
    currentMonth += direction;
    
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    
    updateMonthDisplay();
    updateDashboard();
}

function updateMonthDisplay() {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    document.getElementById('currentMonthDisplay').textContent = `${monthNames[currentMonth]} ${currentYear}`;
}

// Spending Insights Functions
function generateAIInsights() {
    const monthlyTransactions = getMonthlyTransactions();
    
    if (monthlyTransactions.length === 0) {
        return "Welcome! Start adding transactions to get personalized insights about your spending habits.";
    }
    
    // Check if user has been over budget in specific categories for at least two consecutive months
    const habituallyOverBudgetCategories = checkHabitualOverBudgetCategories();
    
    if (habituallyOverBudgetCategories.length > 0) {
        const categoryNames = habituallyOverBudgetCategories.map(cat => getCategoryDisplayName(cat));
        return `⚠️ You've been over budget in ${categoryNames.join(', ')} for multiple consecutive months, indicating habitual overspending in these categories. Consider reducing spending in these areas or reallocating your budget to better reflect your actual spending patterns.`;
    }
    
    const insights = [];
    
    // Calculate spending patterns
    const totalSpent = monthlyTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalIncome = monthlyTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    
    // Category analysis
    const categorySpending = {};
    const categoryCount = {};
    
    monthlyTransactions.filter(t => t.amount < 0).forEach(transaction => {
        const category = transaction.category;
        categorySpending[category] = (categorySpending[category] || 0) + Math.abs(transaction.amount);
        categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    const topSpendingCategory = Object.keys(categorySpending).reduce((a, b) => 
        categorySpending[a] > categorySpending[b] ? a : b, '');
    
    const mostFrequentCategory = Object.keys(categoryCount).reduce((a, b) => 
        categoryCount[a] > categoryCount[b] ? a : b, '');
    
    // Generate insights
    if (totalSpent > 0) {
        const avgTransaction = totalSpent / monthlyTransactions.filter(t => t.amount < 0).length;
        
        if (avgTransaction > 100) {
            insights.push(`Your average transaction is ${formatCurrency(avgTransaction)}, which is above typical spending levels.`);
        }
        
        if (topSpendingCategory && categorySpending[topSpendingCategory] > totalSpent * 0.4) {
            insights.push(`You're spending ${Math.round((categorySpending[topSpendingCategory] / totalSpent) * 100)}% of your money on ${getCategoryDisplayName(topSpendingCategory)}.`);
        }
        
        if (mostFrequentCategory && categoryCount[mostFrequentCategory] > 5) {
            insights.push(`You make frequent purchases in ${getCategoryDisplayName(mostFrequentCategory)} (${categoryCount[mostFrequentCategory]} times this month).`);
        }
    }
    
    // Compare with previous month
    const previousMonthTransactions = getPreviousMonthTransactions();
    if (previousMonthTransactions.length > 0) {
        const previousTotalSpent = previousMonthTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        if (totalSpent > previousTotalSpent * 1.2) {
            insights.push(`You're spending ${Math.round(((totalSpent - previousTotalSpent) / previousTotalSpent) * 100)}% more than last month.`);
        } else if (totalSpent < previousTotalSpent * 0.8) {
            insights.push(`Great job! You're spending ${Math.round(((previousTotalSpent - totalSpent) / previousTotalSpent) * 100)}% less than last month.`);
        }
    }
    
    // Budget insights
    if (settings.budgetValues && settings.budgetValues[settings.budgetType]) {
        const budgetValues = settings.budgetValues[settings.budgetType];
        const overBudgetCategories = [];
        
        Object.keys(budgetValues).forEach(category => {
            const budget = budgetValues[category];
            const spent = categorySpending[category] || 0;
            
            if (settings.budgetType === 'dollar' && spent > budget) {
                overBudgetCategories.push(getCategoryDisplayName(category));
            } else if (settings.budgetType === 'percentage' && totalSpent > 0) {
                const spentPercentage = (spent / totalSpent) * 100;
                if (spentPercentage > budget) {
                    overBudgetCategories.push(getCategoryDisplayName(category));
                }
            }
        });
        
        if (overBudgetCategories.length > 0) {
            insights.push(`You're over budget in: ${overBudgetCategories.join(', ')}.`);
        }
    }
    
    return insights.length > 0 ? insights.join(' ') : "Your spending patterns look balanced this month!";
}

function refreshInsights() {
    const insightsElement = document.getElementById('spendingInsights');
    insightsElement.innerHTML = '<p>Generating insights...</p>';
    
    setTimeout(() => {
        const insights = generateAIInsights();
        insightsElement.innerHTML = `<p>${insights}</p>`;
    }, 500);
}

function checkHabitualOverBudgetCategories() {
    if (!settings.budgetValues || !settings.budgetValues[settings.budgetType]) {
        return [];
    }
    
    const budgetValues = settings.budgetValues[settings.budgetType];
    const habituallyOverBudgetCategories = [];
    
    // Check each category for habitual overspending
    Object.keys(budgetValues).forEach(category => {
        const budget = budgetValues[category];
        let consecutiveOverBudgetMonths = 0;
        
        // Check current month
        const currentMonthTransactions = getMonthlyTransactions();
        const currentMonthCategorySpent = currentMonthTransactions
            .filter(t => t.amount < 0 && t.category === category)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        let isCurrentMonthOverBudget = false;
        if (settings.budgetType === 'dollar') {
            isCurrentMonthOverBudget = currentMonthCategorySpent > budget;
        } else if (settings.budgetType === 'percentage') {
            const currentMonthTotalSpent = currentMonthTransactions
                .filter(t => t.amount < 0)
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const spentPercentage = currentMonthTotalSpent > 0 ? (currentMonthCategorySpent / currentMonthTotalSpent) * 100 : 0;
            isCurrentMonthOverBudget = spentPercentage > budget;
        }
        
        // Check if current month is NOT over budget, but the previous 2 months were
        if (!isCurrentMonthOverBudget) {
            let previousMonthsOverBudget = 0;
            
            // Check previous months (up to 2 months back)
            for (let i = 1; i <= 2; i++) {
                const previousMonth = new Date(currentYear, currentMonth - i, 1);
                const previousMonthTransactions = transactions.filter(t => {
                    const transactionDate = parseDate(t.date);
                    return transactionDate && 
                           transactionDate.getMonth() === previousMonth.getMonth() && 
                           transactionDate.getFullYear() === previousMonth.getFullYear();
                });
                
                const previousMonthCategorySpent = previousMonthTransactions
                    .filter(t => t.amount < 0 && t.category === category)
                    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
                
                let isPreviousMonthOverBudget = false;
                if (settings.budgetType === 'dollar') {
                    isPreviousMonthOverBudget = previousMonthCategorySpent > budget;
                } else if (settings.budgetType === 'percentage') {
                    const previousMonthTotalSpent = previousMonthTransactions
                        .filter(t => t.amount < 0)
                        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
                    const spentPercentage = previousMonthTotalSpent > 0 ? (previousMonthCategorySpent / previousMonthTotalSpent) * 100 : 0;
                    isPreviousMonthOverBudget = spentPercentage > budget;
                }
                
                if (isPreviousMonthOverBudget) {
                    previousMonthsOverBudget++;
                } else {
                    break; // Stop counting if we find a month that's not over budget
                }
            }
            
            // If the previous 2 months were over budget, add it to the list
            if (previousMonthsOverBudget >= 2) {
                habituallyOverBudgetCategories.push(category);
            }
        }
    });
    
    return habituallyOverBudgetCategories;
}

function getMonthlyTransactions() {
    return transactions.filter(t => {
        const transactionDate = parseDate(t.date);
        return transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear &&
               t.status !== 'pending';
    });
}

function getPreviousMonthTransactions() {
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    
    if (prevMonth < 0) {
        prevMonth = 11;
        prevYear--;
    }
    
    return transactions.filter(t => {
        const transactionDate = parseDate(t.date);
        return transactionDate.getMonth() === prevMonth && 
               transactionDate.getFullYear() === prevYear &&
               t.status !== 'pending';
    });
}

// Dashboard Customization Functions
function toggleDashboardStat(statName) {
    dashboardStats[statName] = !dashboardStats[statName];
    updateDashboardStatsVisibility();
    saveDashboardSettings();
}

function updateDashboardStatsVisibility() {
    Object.keys(dashboardStats).forEach(stat => {
        const card = document.querySelector(`[data-stat="${stat}"]`);
        if (card) {
            if (dashboardStats[stat]) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        }
    });
}

function loadDashboardSettings() {
    let savedStats;
    if (currentUser) {
        savedStats = localStorage.getItem(`dashboardStats_${currentUser.id}`);
    } else {
        savedStats = localStorage.getItem('dashboardStats');
    }
    
    if (savedStats) {
        dashboardStats = { ...dashboardStats, ...JSON.parse(savedStats) };
    }
    
    // Update checkboxes
    Object.keys(dashboardStats).forEach(stat => {
        const checkbox = document.getElementById(`show${stat.charAt(0).toUpperCase() + stat.slice(1)}`);
        if (checkbox) {
            checkbox.checked = dashboardStats[stat];
        }
    });
    
    updateDashboardStatsVisibility();
}

function saveDashboardSettings() {
    if (currentUser) {
        localStorage.setItem(`dashboardStats_${currentUser.id}`, JSON.stringify(dashboardStats));
    } else {
        localStorage.setItem('dashboardStats', JSON.stringify(dashboardStats));
    }
    showNotification('Dashboard settings saved!', 'success');
}

// Chat functionality
let chatHistory = [];

// Save chat history to localStorage
function saveChatHistory() {
    console.log('Saving chat history with', chatHistory.length, 'messages');
    console.log('Chat history content:', chatHistory);
    
    if (currentUser) {
        // Save user-specific chat history
        const userChatKey = `chatHistory_${currentUser.email}`;
        const chatHistoryJson = JSON.stringify(chatHistory);
        localStorage.setItem(userChatKey, chatHistoryJson);
        console.log('Saved user chat history:', chatHistory.length, 'messages to', userChatKey);
        console.log('Saved JSON:', chatHistoryJson);
    } else {
        // Save global chat history for non-authenticated users
        const chatHistoryJson = JSON.stringify(chatHistory);
        localStorage.setItem('chatHistory', chatHistoryJson);
        console.log('Saved global chat history:', chatHistory.length, 'messages');
        console.log('Saved JSON:', chatHistoryJson);
    }
}

// Load chat history from localStorage
function loadChatHistory() {
    console.log('Loading chat history...');
    
    // Don't reset chat history here - let the loading process handle it
    
    if (currentUser) {
        // Load user-specific chat history
        const userChatKey = `chatHistory_${currentUser.email}`;
        const savedChat = localStorage.getItem(userChatKey);
        if (savedChat) {
            try {
                console.log('Raw saved chat data:', savedChat);
                const parsedHistory = JSON.parse(savedChat);
                console.log('Parsed chat history:', parsedHistory);
                
                // Validate the parsed data
                if (Array.isArray(parsedHistory)) {
                    chatHistory = parsedHistory;
                    console.log('Loaded user chat history:', chatHistory.length, 'messages for', currentUser.email);
                } else {
                    console.error('Parsed chat history is not an array:', parsedHistory);
                    chatHistory = [];
                }
            } catch (error) {
                console.error('Error parsing user chat history:', error);
                chatHistory = [];
            }
        } else {
            console.log('No saved chat history found for user:', currentUser.email);
            chatHistory = [];
        }
    } else {
        // Load global chat history for non-authenticated users
        const savedChat = localStorage.getItem('chatHistory');
        if (savedChat) {
            try {
                const parsedHistory = JSON.parse(savedChat);
                console.log('Parsed global chat history:', parsedHistory);
                
                // Validate the parsed data
                if (Array.isArray(parsedHistory)) {
                    chatHistory = parsedHistory;
                    console.log('Loaded global chat history:', chatHistory.length, 'messages');
                } else {
                    console.error('Parsed global chat history is not an array:', parsedHistory);
                    chatHistory = [];
                }
            } catch (error) {
                console.error('Error parsing global chat history:', error);
                chatHistory = [];
            }
        } else {
            console.log('No saved global chat history found');
            chatHistory = [];
        }
    }
    
    // Display loaded chat history
    displayChatHistory();
}

// Display chat history in the chat interface
function displayChatHistory() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.log('Chat messages container not found - section may not be visible yet');
        return;
    }
    
    console.log('Displaying chat history:', chatHistory.length, 'messages');
    
    // Clear all existing messages
    chatMessages.innerHTML = '';
    
    // Add welcome message if no chat history exists
    if (chatHistory.length === 0) {
        console.log('No chat history, showing welcome message');
        addChatMessage('Hello! I\'m your financial assistant. Ask me anything about budgeting, saving money, or financial planning!', 'bot', false);
    } else {
        // Display chat history
        console.log('Displaying existing chat history');
        chatHistory.forEach((chatItem, index) => {
            if (chatItem && chatItem.message && chatItem.sender) {
                console.log(`Displaying message ${index + 1}:`, chatItem.sender, chatItem.message.substring(0, 50) + '...');
                addChatMessage(chatItem.message, chatItem.sender, false); // false = don't save to history again
            } else {
                console.warn('Invalid chat item at index', index, chatItem);
            }
        });
    }
}

// Clear chat history
function clearChatHistory() {
    chatHistory = [];
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        // Add welcome message back
        addChatMessage('Hello! I\'m your financial assistant. Ask me anything about budgeting, saving money, or financial planning!', 'bot', false);
    }
    saveChatHistory();
}

// Handle chat form submission
async function handleChatSubmit(e) {
    e.preventDefault();
    
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addChatMessage(message, 'user');
    chatInput.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Get AI response
        const response = await getAIResponse(message);
        
        // Remove typing indicator and add bot response
        removeTypingIndicator();
        addChatMessage(response, 'bot');
        
    } catch (error) {
        console.error('Error getting AI response:', error);
        removeTypingIndicator();
        addChatMessage('Sorry, I encountered an error while processing your request. Please try again.', 'bot');
    }
}

// Add message to chat
function addChatMessage(message, sender, saveToHistory = true) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatar = sender === 'bot' ? '🤖' : '👤';
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-avatar">${avatar}</div>
            <div class="message-text">
                <p>${formatChatMessage(message)}</p>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add to chat history and save if requested
    if (saveToHistory) {
        console.log('Adding message to chat history:', sender, message.substring(0, 50) + '...');
        chatHistory.push({ sender, message, timestamp: new Date() });
        console.log('Chat history now has', chatHistory.length, 'messages');
        saveChatHistory();
    }
}

// Format chat message (handle line breaks and basic formatting)
function formatChatMessage(message) {
    return message
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// Show typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message';
    typingDiv.id = 'typingIndicator';
    
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="message-avatar">🤖</div>
            <div class="message-text">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Get AI response from cloud worker
async function getAIResponse(message) {
    const cloudWorkerUrl = 'https://loreal-worker.varunikavijay04.workers.dev/';
    
    // Prepare the request payload
    const payload = {
        messages: [
            {
                role: "system",
                content: `You are a fun, energetic, and engaging AI financial assistant! Keep the conversation short, but include helpful tips and advice as needed and prioritized. 🎉 Your personality is upbeat, encouraging, and uses emojis and casual language to make finance feel approachable. Keep your answers SHORT and punchy (max 2-3 sentences) to avoid text cutoff. You can ONLY answer questions about finance, spending, budgeting, saving, investing, debt, credit, taxes, and money management. If someone asks about anything else, politely redirect them back to financial topics with a fun quip like '💰 Let's talk money instead!' or '🎯 I'm your money buddy - ask me about budgets, savings, or investments!' Always be encouraging and make financial advice feel exciting and achievable!`
            },
            {
                role: "user",
                content: message
            }
        ],
        max_tokens: 500,
        temperature: 0.7
    };
    
    try {
        const response = await fetch(cloudWorkerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content;
        } else {
            throw new Error('Invalid response format from AI service');
        }
        
    } catch (error) {
        console.error('Error calling AI service:', error);
        throw error;
    }
}

// Theme Toggle Functions
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    updateThemeIcon(newTheme);
    saveThemePreference(newTheme);
    updateChartColors();
}

function updateThemeIcon(theme) {
    // Theme icon is now handled by the theme buttons in settings
}

function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    updateThemeButtons(savedTheme);
}

function saveThemePreference(theme) {
    localStorage.setItem('theme', theme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
    saveThemePreference(theme);
    updateThemeButtons(theme);
    updateChartColors();
}

function updateThemeButtons(theme) {
    const darkBtn = document.getElementById('darkThemeBtn');
    const lightBtn = document.getElementById('lightThemeBtn');
    
    if (darkBtn && lightBtn) {
        darkBtn.classList.toggle('active', theme === 'dark');
        lightBtn.classList.toggle('active', theme === 'light');
    }
}




// ====================================================================
// *** CONFIGURAÇÃO ESSENCIAL ***
// ====================================================================

// ATENÇÃO: SUBSTITUA ESTA URL PELA URL PÚBLICA DO SEU SERVIDOR NO RENDER.
// Exemplo: 'https://eternit-backend-api.onrender.com'
const BASE_URL = 'https://eternit-backend-api.onrender.com'; 

// ====================================================================
// *** REFERÊNCIAS DA INTERFACE (DOM) ***
// ====================================================================

// Login/Geral
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const createAccountBtn = document.getElementById('create-account-btn');
const messageDisplay = document.getElementById('message');
const bankContainer = document.getElementById('bank-container');
const loginContainer = document.getElementById('login-container');
const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');

// Display de Saldo/Nome
const displayUsername = document.getElementById('display-username');
const headerDisplayUsername = document.getElementById('header-display-username');
const currentBalanceDisplay = document.getElementById('current-balance');

// Menu FAB
const fab = document.getElementById('fab');
const fabMenu = document.getElementById('fab-menu');
const addBillOption = document.getElementById('add-bill-option');

// Modal Depósito (Bill Deposit - Reutilizado para Transferência neste código)
const billDepositModal = document.getElementById('bill-deposit-modal');
const closeBillModalBtn = document.getElementById('close-bill-modal-btn');
// O botão submitBillBtn será usado para iniciar a transferência
const submitBillBtn = document.getElementById('submit-bill-btn'); 
// O campo billCodeInput será usado para o nome de usuário do destinatário
const billCodeInput = document.getElementById('bill-code'); 
// Vamos adicionar um novo campo para o valor da transferência na sua UI (se necessário)
const billValueInput = document.getElementById('bill-value'); // Assumindo que você criou este campo
const billMessageDisplay = document.getElementById('bill-message');

// ====================================================================
// *** FUNÇÕES DE UTILIDADE E UI ***
// ====================================================================

let loggedInUsername = ''; 

// Obtém o token de autenticação salvo no navegador
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Altera a visibilidade principal da aplicação (Login vs. Banco)
function toggleView(isLoggedIn) {
    const header = document.getElementById('main-header');
    const sidebar = document.getElementById('sidebar');
    
    if (isLoggedIn) {
        loginContainer.classList.add('hidden');
        bankContainer.classList.remove('hidden');
        header.classList.remove('hidden');
        sidebar.classList.remove('hidden');
        fab.classList.remove('hidden');
    } else {
        loginContainer.classList.remove('hidden');
        bankContainer.classList.add('hidden');
        header.classList.add('hidden');
        sidebar.classList.add('hidden');
        fab.classList.add('hidden');
        localStorage.removeItem('authToken'); 
        loggedInUsername = '';
    }
}

// Funções de Modal
fab.addEventListener('click', () => {
    fabMenu.classList.toggle('hidden');
});

addBillOption.addEventListener('click', () => {
    billDepositModal.classList.remove('hidden');
    fabMenu.classList.add('hidden');
    // Renomeando a modal para a função de Transferência
    document.querySelector('#bill-deposit-modal h2').textContent = "Realizar Transferência";
    document.querySelector('label[for="bill-code"]').textContent = "Nome de Usuário (Destinatário):";
    // Limpa campos
    billMessageDisplay.textContent = '';
    billCodeInput.value = '';
    if (billValueInput) billValueInput.value = '';
});

closeBillModalBtn.addEventListener('click', () => {
    billDepositModal.classList.add('hidden');
    billMessageDisplay.textContent = '';
    billCodeInput.value = '';
    if (billValueInput) billValueInput.value = '';
});

// ====================================================================
// *** COMUNICAÇÃO COM API (BACK-END) ***
// ====================================================================

// Função para buscar o saldo e nome do usuário logado
async function updateDisplay() {
    const token = getAuthToken();
    if (!token) return toggleView(false);

    try {
        const response = await fetch(`${BASE_URL}/api/user/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            loggedInUsername = data.username;
            displayUsername.textContent = data.username;
            headerDisplayUsername.textContent = data.username;
            currentBalanceDisplay.textContent = data.balance.toFixed(2);
        } else {
            // Se o token for inválido/expirado, desloga
            toggleView(false);
        }
    } catch (error) {
        console.error('Erro de rede ao buscar dados do usuário:', error);
    }
}

// Inicialização: Verifica o token ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    if (getAuthToken()) {
        updateDisplay();
        toggleView(true);
    }
});

// ====================================================================
// *** AUTENTICAÇÃO E CADASTRO ***
// ====================================================================

// 1. Login
loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    messageDisplay.textContent = '';

    try {
        const response = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            loggedInUsername = data.username;
            await updateDisplay();
            toggleView(true);
        } else {
            messageDisplay.textContent = data.message || 'Erro de Login. Tente novamente.';
        }
    } catch (error) {
        messageDisplay.textContent = 'Erro de rede. Servidor indisponível.';
    }
});

// 2. Criação de Conta
createAccountBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    messageDisplay.textContent = '';

    try {
        const response = await fetch(`${BASE_URL}/api/create-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            messageDisplay.textContent = `Sucesso! Conta de ${data.user.username} criada. Faça login. (Saldo inicial: 1000.00 Ə)`;
            messageDisplay.classList.remove('error-message');
        } else {
            messageDisplay.textContent = data.message || 'Erro ao criar conta.';
            messageDisplay.classList.add('error-message');
        }
    } catch (error) {
        messageDisplay.textContent = 'Erro de rede. Servidor indisponível.';
    }
});

// 3. Logout
logoutBtnSidebar.addEventListener('click', () => {
    toggleView(false);
});

// ====================================================================
// *** FUNCIONALIDADE DE TRANSFERÊNCIA ***
// ====================================================================

// Função para buscar usuários (API: /api/users/search)
async function searchUsers(query) {
    const token = getAuthToken();
    if (!token || query.length < 3) return [];

    try {
        const response = await fetch(`${BASE_URL}/api/users/search?q=${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            return await response.json(); 
        }
    } catch (error) {
        console.error('Erro na pesquisa:', error);
    }
    return [];
}

// 1. Execução da Transferência
async function performTransfer(recipientUsername, amount) {
    const token = getAuthToken();
    if (!token) return billMessageDisplay.textContent = "Erro: Usuário não autenticado.";

    try {
        const response = await fetch(`${BASE_URL}/api/transfer`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                recipientUsername: recipientUsername, 
                amount: parseFloat(amount) 
            })
        });

        const data = await response.json();

        if (response.ok) {
            billMessageDisplay.textContent = `Transferência de ${amount} Ə para ${recipientUsername} realizada com sucesso! Novo saldo: ${data.newBalance.toFixed(2)} Ə`;
            billMessageDisplay.classList.remove('error-message');
            await updateDisplay(); 
            // Não fecha a modal automaticamente para o usuário ver a confirmação
        } else {
            billMessageDisplay.textContent = data.message || 'Falha na Transferência.';
            billMessageDisplay.classList.add('error-message');
        }
    } catch (error) {
        billMessageDisplay.textContent = 'Erro de rede ao processar transferência.';
        billMessageDisplay.classList.add('error-message');
    }
}

// 2. Evento do Botão de Envio (Assumindo que o usuário usa a modal para transferir)
submitBillBtn.addEventListener('click', async (e) => {
    e.preventDefault(); // Impede o envio padrão do formulário

    const destinatario = billCodeInput.value.trim();
    // Pega o valor do campo de valor da transferência
    const valor = billValueInput ? billValueInput.value : prompt("Por favor, insira o valor da transferência:");
    
    if (!destinatario || !valor || isNaN(valor) || parseFloat(valor) <= 0) {
        billMessageDisplay.textContent = "Por favor, preencha o destinatário e o valor corretamente.";
        billMessageDisplay.classList.add('error-message');
        return;
    }

    // Chama a lógica de API
    await performTransfer(destinatario, valor);
});
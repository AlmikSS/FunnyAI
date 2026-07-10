/**
 * Архитектура SPA симулятора чат-бота.
 * Логика UI, работы с хранилищем и имитации API строго разделены.
 */

// ==========================================
// 1. Storage Manager (Управление данными)
// ==========================================
const StorageAPI = {
    DEFAULT_REPLICAS: [
        "Привет! Я готов к работе.",
        "Это тестовая реплика номер два. Я игнорирую твой текст.",
        "Архитектура клиент-сервер успешно симулирована.",
        "Запрашиваю данные из локальной базы...",
        "Все доступные реплики успешно воспроизведены. Начинаю заново!"
    ],

    getReplicas() {
        const data = localStorage.getItem('bot_replicas');
        return data ? JSON.parse(data) : this.DEFAULT_REPLICAS;
    },

    saveReplicas(replicasArray) {
        localStorage.setItem('bot_replicas', JSON.stringify(replicasArray));
        // При сохранении нового сценария сбрасываем индекс
        localStorage.setItem('bot_replica_index', '0'); 
    },

    getCurrentIndex() {
        return parseInt(localStorage.getItem('bot_replica_index')) || 0;
    },

    setCurrentIndex(index) {
        localStorage.setItem('bot_replica_index', index.toString());
    },
    
    getChatHistory() {
        const data = localStorage.getItem('chat_history');
        return data ? JSON.parse(data) : [];
    },
    
    saveChatHistory(history) {
        localStorage.setItem('chat_history', JSON.stringify(history));
    },

    clearChat() {
        localStorage.removeItem('chat_history');
        localStorage.setItem('bot_replica_index', '0');
    }
};

// ==========================================
// 2. Chat Service (Имитация или реальное API)
// ==========================================
const ChatService = {
    /**
     * Эта функция спроектирована для легкой замены в будущем.
     * Чтобы подключить реальную модель (например, локальный ONNX Runtime 
     * или внешний сервис Yandex LLM через C# бэкенд), просто замените 
     * логику внутри на fetch-запрос:
     * * const response = await fetch('http://localhost:5000/api/generate', {
     * method: 'POST',
     * body: JSON.stringify({ prompt: userMessage })
     * });
     * return await response.text();
     */
    async getBotResponse(userMessage) {
        return new Promise((resolve) => {
            // Имитация задержки обработки (1 - 2 секунды)
            const delay = Math.floor(Math.random() * 1000) + 1000;
            
            setTimeout(() => {
                const replicas = StorageAPI.getReplicas();
                let currentIndex = StorageAPI.getCurrentIndex();

                if (replicas.length === 0) {
                    resolve("Доступные реплики успешно воспроизведены. Измените сценарий в настройках.");
                    return;
                }

                if (currentIndex >= replicas.length) {
                    currentIndex = 0; // Цикличное повторение
                }

                const reply = replicas[currentIndex];
                StorageAPI.setCurrentIndex(currentIndex + 1);
                
                resolve(reply);
            }, delay);
        });
    }
};

// ==========================================
// 3. UI Controller (Отображение и события)
// ==========================================
const UI = {
    elements: {
        chatContainer: document.getElementById('chatContainer'),
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),
        newChatBtn: document.getElementById('newChatBtn'),
        
        // Settings elements
        settingsModal: document.getElementById('settingsModal'),
        openSettingsBtn: document.getElementById('openSettingsBtn'),
        closeSettingsBtn: document.getElementById('closeSettingsBtn'),
        cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        addReplicaBtn: document.getElementById('addReplicaBtn'),
        replicasList: document.getElementById('replicasList'),
        
        // Mobile menu
        sidebar: document.getElementById('sidebar'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        sidebarOverlay: document.getElementById('sidebarOverlay')
    },

    tempReplicas: [], // Временное хранилище при открытых настройках

    init() {
        lucide.createIcons();
        this.bindEvents();
        this.loadHistory();
        this.autoResizeTextarea();
    },

    bindEvents() {
        // Chat events
        this.elements.sendBtn.addEventListener('click', () => this.handleSend());
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
        this.elements.messageInput.addEventListener('input', () => this.autoResizeTextarea());
        this.elements.newChatBtn.addEventListener('click', () => this.startNewChat());

        // Settings events
        this.elements.openSettingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.elements.cancelSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.elements.addReplicaBtn.addEventListener('click', () => this.addReplicaInput());

        // Mobile menu events
        this.elements.mobileMenuBtn.addEventListener('click', () => this.toggleMobileMenu());
        this.elements.sidebarOverlay.addEventListener('click', () => this.toggleMobileMenu(false));
    },

    autoResizeTextarea() {
        const el = this.elements.messageInput;
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
        this.elements.sendBtn.disabled = el.value.trim().length === 0;
    },

    scrollToBottom() {
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
    },

    // --- Обработка сообщений ---

    async handleSend() {
        const text = this.elements.messageInput.value.trim();
        if (!text) return;

        // Блокируем инпут
        this.elements.messageInput.value = '';
        this.autoResizeTextarea();
        this.elements.messageInput.disabled = true;
        this.elements.sendBtn.disabled = true;

        // 1. Отображаем и сохраняем сообщение пользователя
        this.appendMessage('user', text);
        this.saveToHistory('user', text);

        // 2. Показываем анимацию "Бот печатает..."
        const typingId = this.showTypingIndicator();
        this.scrollToBottom();

        // 3. Получаем ответ от Service Layer
        const botReply = await ChatService.getBotResponse(text);

        // 4. Убираем индикатор, показываем ответ и сохраняем
        this.removeTypingIndicator(typingId);
        this.appendMessage('bot', botReply);
        this.saveToHistory('bot', botReply);

        // Разблокируем инпут
        this.elements.messageInput.disabled = false;
        this.elements.messageInput.focus();
        this.scrollToBottom();
    },

    appendMessage(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = `flex items-start gap-4 max-w-3xl mx-auto w-full ${role === 'user' ? 'flex-row-reverse' : ''}`;
        
        const avatar = role === 'bot' 
            ? `<div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0"><i data-lucide="bot" class="w-5 h-5 text-white"></i></div>`
            : `<div class="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center shrink-0"><i data-lucide="user" class="w-5 h-5 text-white"></i></div>`;

        const bubbleClass = role === 'bot' 
            ? 'bg-gray-750 rounded-tl-none' 
            : 'bg-blue-600 rounded-tr-none text-white';

        wrapper.innerHTML = `
            ${avatar}
            <div class="flex-1 p-4 rounded-2xl ${bubbleClass}">
                <p class="leading-relaxed break-words whitespace-pre-wrap">${this.escapeHTML(text)}</p>
            </div>
        `;
        
        this.elements.chatContainer.appendChild(wrapper);
        lucide.createIcons({ root: wrapper });
    },

    showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const wrapper = document.createElement('div');
        wrapper.id = id;
        wrapper.className = "flex items-start gap-4 max-w-3xl mx-auto w-full";
        
        wrapper.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <i data-lucide="bot" class="w-5 h-5 text-white"></i>
            </div>
            <div class="bg-gray-750 p-2 rounded-2xl rounded-tl-none flex items-center h-12">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        
        this.elements.chatContainer.appendChild(wrapper);
        lucide.createIcons({ root: wrapper });
        return id;
    },

    removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    },

    saveToHistory(role, text) {
        const history = StorageAPI.getChatHistory();
        history.push({ role, text });
        StorageAPI.saveChatHistory(history);
    },

    loadHistory() {
        const history = StorageAPI.getChatHistory();
        // Очищаем контейнер, оставляем только стартовое сообщение (или удаляем его)
        const initialMsg = this.elements.chatContainer.firstElementChild;
        this.elements.chatContainer.innerHTML = '';
        if (initialMsg && history.length === 0) {
            this.elements.chatContainer.appendChild(initialMsg);
        }

        history.forEach(msg => this.appendMessage(msg.role, msg.text));
        this.scrollToBottom();
    },

    startNewChat() {
        StorageAPI.clearChat();
        this.elements.chatContainer.innerHTML = `
            <div class="flex items-start gap-4 max-w-3xl mx-auto w-full">
                <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                    <i data-lucide="bot" class="w-5 h-5 text-white"></i>
                </div>
                <div class="flex-1 bg-gray-750 p-4 rounded-2xl rounded-tl-none">
                    <p class="text-gray-100 leading-relaxed">Новая сессия начата. Я готов отвечать по сценарию.</p>
                </div>
            </div>
        `;
        lucide.createIcons();
        if (window.innerWidth < 768) this.toggleMobileMenu(false);
    },

    // --- Логика Настроек (Реплики) ---

    openSettings() {
        this.tempReplicas = [...StorageAPI.getReplicas()];
        this.renderReplicasSettings();
        this.elements.settingsModal.classList.remove('hidden');
        if (window.innerWidth < 768) this.toggleMobileMenu(false);
    },

    closeSettings() {
        this.elements.settingsModal.classList.add('hidden');
    },

    saveSettings() {
        // Собираем значения из инпутов
        const inputs = this.elements.replicasList.querySelectorAll('input');
        const newReplicas = Array.from(inputs).map(inp => inp.value.trim()).filter(v => v);
        
        StorageAPI.saveReplicas(newReplicas);
        this.closeSettings();
    },

    renderReplicasSettings() {
        this.elements.replicasList.innerHTML = '';
        this.tempReplicas.forEach((text, index) => {
            this.elements.replicasList.appendChild(this.createReplicaInput(text, index));
        });
        lucide.createIcons({ root: this.elements.replicasList });
    },

    createReplicaInput(text, index) {
        const div = document.createElement('div');
        div.className = "flex items-center gap-2 group";
        
        div.innerHTML = `
            <div class="cursor-move text-gray-500 group-hover:text-gray-300 transition-colors">
                <i data-lucide="grip-vertical" class="w-4 h-4"></i>
            </div>
            <input type="text" value="${this.escapeHTML(text)}" 
                class="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-500" 
                placeholder="Текст реплики...">
            <button class="text-gray-500 hover:text-red-400 p-2 transition-colors delete-replica-btn">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;

        div.querySelector('.delete-replica-btn').addEventListener('click', () => {
            div.remove();
        });

        return div;
    },

    addReplicaInput() {
        const inputDiv = this.createReplicaInput("", this.tempReplicas.length);
        this.elements.replicasList.appendChild(inputDiv);
        lucide.createIcons({ root: inputDiv });
        inputDiv.querySelector('input').focus();
    },

    // --- Утилиты ---

    toggleMobileMenu(forceState) {
        const isOpen = !this.elements.sidebar.classList.contains('-translate-x-full');
        const newState = forceState !== undefined ? forceState : !isOpen;

        if (newState) {
            this.elements.sidebar.classList.remove('-translate-x-full');
            this.elements.sidebarOverlay.classList.remove('hidden');
        } else {
            this.elements.sidebar.classList.add('-translate-x-full');
            this.elements.sidebarOverlay.classList.add('hidden');
        }
    },

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
};

// Запуск приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});
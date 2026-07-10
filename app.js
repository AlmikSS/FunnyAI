/**
 * CCG AI - Core Application Logic
 */

// ==========================================
// 1. Data Models & Storage
// ==========================================
const StorageAPI = {
    // Дефолтные реплики с уклоном в разработку игр (C#, Unity, Сервер)
    DEFAULT_SCRIPT: [
        "Анализ архитектуры завершен. Авторитативный сервер настроен корректно.",
        "Для оптимизации вычислений в Unity рекомендую перенести этот LINQ запрос в кэш или использовать обычный цикл for. Garbage Collector может вызывать фризы.",
        "Я сгенерировал C# сервис для потоковой передачи данных. Интеграция с ONNX Runtime прошла успешно.",
        "Задержка предсказания клиента (Client Prediction) снижена на 14мс. Синхронизация работает стабильно.",
        "Сборка проекта под целевую платформу выполнена без ошибок."
    ],

    getScript() {
        const data = localStorage.getItem('ccg_script');
        return data ? JSON.parse(data) : this.DEFAULT_SCRIPT;
    },

    saveScript(scriptArray) {
        localStorage.setItem('ccg_script', JSON.stringify(scriptArray));
    },

    // Работа с чатами
    getChats() {
        const data = localStorage.getItem('ccg_chats');
        return data ? JSON.parse(data) : [];
    },

    saveChats(chats) {
        localStorage.setItem('ccg_chats', JSON.stringify(chats));
    },

    getActiveChatId() {
        return localStorage.getItem('ccg_active_chat');
    },

    setActiveChatId(id) {
        if(id) localStorage.setItem('ccg_active_chat', id);
        else localStorage.removeItem('ccg_active_chat');
    },

    createChat() {
        const chats = this.getChats();
        const newChat = {
            id: 'chat_' + Date.now(),
            title: 'Новый диалог',
            messages: [],
            scriptIndex: 0,
            date: new Date().toISOString()
        };
        chats.unshift(newChat); // Добавляем в начало
        this.saveChats(chats);
        this.setActiveChatId(newChat.id);
        return newChat;
    },

    getChat(id) {
        return this.getChats().find(c => c.id === id);
    },

    updateChat(updatedChat) {
        let chats = this.getChats();
        const index = chats.findIndex(c => c.id === updatedChat.id);
        if (index !== -1) {
            chats[index] = updatedChat;
            this.saveChats(chats);
        }
    },

    deleteAllChats() {
        localStorage.removeItem('ccg_chats');
        localStorage.removeItem('ccg_active_chat');
    }
};

// ==========================================
// 2. AI Generator Service
// ==========================================
const AIService = {
    async generateResponse(chatId) {
        return new Promise((resolve) => {
            const delay = Math.floor(Math.random() * 800) + 800; // 0.8 - 1.6 сек
            
            setTimeout(() => {
                const script = StorageAPI.getScript();
                const chat = StorageAPI.getChat(chatId);
                
                if (!chat) return resolve("Ошибка контекста.");
                if (script.length === 0) return resolve("База данных пуста. Заполните базу в настройках.");

                let index = chat.scriptIndex || 0;
                if (index >= script.length) index = 0;

                const reply = script[index];
                
                // Обновляем индекс в чате
                chat.scriptIndex = index + 1;
                StorageAPI.updateChat(chat);
                
                resolve(reply);
            }, delay);
        });
    }
};

// ==========================================
// 3. UI Controller
// ==========================================
const UI = {
    activeChat: null,
    tempScript: [],

    init() {
        this.cacheDOM();
        lucide.createIcons();
        this.bindEvents();
        
        // Инициализация первого чата, если ничего нет
        let chats = StorageAPI.getChats();
        let activeId = StorageAPI.getActiveChatId();
        
        if (chats.length === 0) {
            this.activeChat = StorageAPI.createChat();
        } else {
            this.activeChat = chats.find(c => c.id === activeId) || chats[0];
            StorageAPI.setActiveChatId(this.activeChat.id);
        }

        this.renderSidebar();
        this.renderChat();
        this.autoResizeTextarea();
    },

    cacheDOM() {
        this.dom = {
            chatContainer: document.getElementById('chatContainer'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            newChatBtn: document.getElementById('newChatBtn'),
            chatList: document.getElementById('chatList'),
            
            // Settings
            settingsModal: document.getElementById('settingsModal'),
            settingsContent: document.getElementById('settingsContent'),
            openSettingsBtn: document.getElementById('openSettingsBtn'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            addReplicaBtn: document.getElementById('addReplicaBtn'),
            clearAllReplicasBtn: document.getElementById('clearAllReplicasBtn'),
            replicasList: document.getElementById('replicasList'),
            deleteAllChatsBtn: document.getElementById('deleteAllChatsBtn'),
            settingsFooter: document.getElementById('settingsFooter'),
            
            // Mobile
            sidebar: document.getElementById('sidebar'),
            mobileMenuBtn: document.getElementById('mobileMenuBtn'),
            sidebarOverlay: document.getElementById('sidebarOverlay')
        };
    },

    bindEvents() {
        // Окно ввода
        this.dom.sendBtn.addEventListener('click', () => this.sendMessage());
        this.dom.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.dom.messageInput.addEventListener('input', () => this.autoResizeTextarea());
        
        // Боковая панель
        this.dom.newChatBtn.addEventListener('click', () => this.handleNewChat());
        
        // Настройки
        this.dom.openSettingsBtn.addEventListener('click', () => this.openSettings());
        document.querySelectorAll('.close-settings').forEach(btn => {
            btn.addEventListener('click', () => this.closeSettings());
        });
        this.dom.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.dom.addReplicaBtn.addEventListener('click', () => this.addReplicaInput());
        this.dom.clearAllReplicasBtn.addEventListener('click', () => this.clearAllReplicas());
        this.dom.deleteAllChatsBtn.addEventListener('click', () => this.deleteAllChats());

        // Вкладки настроек
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSettingsTab(e.currentTarget));
        });

        // Мобильное меню
        this.dom.mobileMenuBtn.addEventListener('click', () => this.toggleMobileMenu(true));
        this.dom.sidebarOverlay.addEventListener('click', () => this.toggleMobileMenu(false));
    },

    // --- Core Chat Logic ---

    handleNewChat() {
        this.activeChat = StorageAPI.createChat();
        this.renderSidebar();
        this.renderChat();
        if (window.innerWidth < 768) this.toggleMobileMenu(false);
        this.dom.messageInput.focus();
    },

    switchChat(id) {
        if (this.activeChat.id === id) return;
        this.activeChat = StorageAPI.getChat(id);
        StorageAPI.setActiveChatId(id);
        this.renderSidebar();
        this.renderChat();
        if (window.innerWidth < 768) this.toggleMobileMenu(false);
    },

    renderSidebar() {
        const chats = StorageAPI.getChats();
        this.dom.chatList.innerHTML = '';
        
        chats.forEach(chat => {
            const isActive = this.activeChat && this.activeChat.id === chat.id;
            const btn = document.createElement('button');
            btn.className = `w-full text-left truncate px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive 
                ? 'bg-borderDark text-white font-medium shadow-sm' 
                : 'text-gray-400 hover:bg-borderDark/50 hover:text-gray-200'
            }`;
            btn.textContent = chat.title;
            btn.onclick = () => this.switchChat(chat.id);
            this.dom.chatList.appendChild(btn);
        });
    },

    renderChat() {
        this.dom.chatContainer.innerHTML = '';
        
        if (!this.activeChat || this.activeChat.messages.length === 0) {
            // Экран пустого чата
            this.dom.chatContainer.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center opacity-50 select-none">
                    <div class="w-16 h-16 rounded-2xl bg-borderDark flex items-center justify-center mb-4">
                        <i data-lucide="sparkles" class="w-8 h-8 text-accent"></i>
                    </div>
                    <h2 class="text-xl font-semibold text-white mb-2">Чем я могу помочь?</h2>
                    <p class="text-sm text-gray-400">CCG AI готов к работе.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        this.activeChat.messages.forEach(msg => this.appendMessageDOM(msg.role, msg.text, false));
        this.scrollToBottom();
    },

    async sendMessage() {
        const text = this.dom.messageInput.value.trim();
        if (!text) return;

        // Если это первое сообщение в чате, обновляем заголовок
        if (this.activeChat.messages.length === 0) {
            this.activeChat.title = text.length > 25 ? text.substring(0, 25) + '...' : text;
            this.dom.chatContainer.innerHTML = ''; // Убираем экран приветствия
        }

        // Блокировка UI
        this.dom.messageInput.value = '';
        this.autoResizeTextarea();
        this.dom.messageInput.disabled = true;
        this.dom.sendBtn.disabled = true;

        // Сохранение и рендер пользователя
        this.activeChat.messages.push({ role: 'user', text });
        StorageAPI.updateChat(this.activeChat);
        this.renderSidebar(); // Обновляем название в сайдбаре
        this.appendMessageDOM('user', text, true);

        // Индикатор набора
        const typingId = this.showTypingIndicator();
        this.scrollToBottom();

        // Генерация ответа
        const reply = await AIService.generateResponse(this.activeChat.id);

        // Сохранение и рендер ИИ
        this.removeTypingIndicator(typingId);
        this.activeChat.messages.push({ role: 'bot', text: reply });
        StorageAPI.updateChat(this.activeChat);
        this.appendMessageDOM('bot', reply, true);

        // Разблокировка UI
        this.dom.messageInput.disabled = false;
        this.dom.messageInput.focus();
        this.scrollToBottom();
    },

    appendMessageDOM(role, text, animate) {
        const wrapper = document.createElement('div');
        const animClass = animate ? 'message-appear' : '';
        wrapper.className = `flex items-start gap-4 max-w-3xl mx-auto w-full ${role === 'user' ? 'flex-row-reverse' : ''} ${animClass}`;
        
        const avatar = role === 'bot' 
            ? `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-accent/20 border border-white/10"><i data-lucide="sparkles" class="w-4 h-4 text-white"></i></div>`
            : `<div class="w-8 h-8 rounded-full bg-borderDark flex items-center justify-center shrink-0 border border-gray-700"><i data-lucide="user" class="w-4 h-4 text-gray-400"></i></div>`;

        const bubbleClass = role === 'bot' 
            ? 'text-gray-100 mt-1' 
            : 'bg-panelDark border border-borderDark text-white px-5 py-3 rounded-2xl rounded-tr-sm shadow-sm';

        wrapper.innerHTML = `
            ${avatar}
            <div class="flex-1 ${role === 'user' ? 'max-w-[80%]' : ''}">
                ${role === 'bot' ? `<div class="font-semibold text-sm text-gray-300 mb-1 flex items-center gap-2">CCG AI <span class="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded text-uppercase">PRO</span></div>` : ''}
                <div class="${bubbleClass}">
                    <p class="leading-relaxed break-words whitespace-pre-wrap text-[15px]">${this.escapeHTML(text)}</p>
                </div>
            </div>
        `;
        
        this.dom.chatContainer.appendChild(wrapper);
        lucide.createIcons({ root: wrapper });
    },

    showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const wrapper = document.createElement('div');
        wrapper.id = id;
        wrapper.className = "flex items-start gap-4 max-w-3xl mx-auto w-full message-appear";
        
        wrapper.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shrink-0 border border-white/10">
                <i data-lucide="sparkles" class="w-4 h-4 text-white"></i>
            </div>
            <div class="flex-1 mt-1">
                <div class="font-semibold text-sm text-gray-300 mb-2">CCG AI</div>
                <div class="typing-indicator px-1">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        
        this.dom.chatContainer.appendChild(wrapper);
        lucide.createIcons({ root: wrapper });
        return id;
    },

    removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    },

    autoResizeTextarea() {
        const el = this.dom.messageInput;
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
        this.dom.sendBtn.disabled = el.value.trim().length === 0;
    },

    scrollToBottom() {
        this.dom.chatContainer.scrollTo({
            top: this.dom.chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    },

    // --- Settings & Prompts Logic ---

    openSettings() {
        this.dom.settingsModal.classList.remove('hidden');
        // Анимация появления
        setTimeout(() => {
            this.dom.settingsContent.classList.remove('scale-95', 'opacity-0');
            this.dom.settingsContent.classList.add('scale-100', 'opacity-100');
        }, 10);
        
        this.tempScript = [...StorageAPI.getScript()];
        this.renderSettingsScript();
        
        // Открываем первую вкладку
        this.switchSettingsTab(document.querySelector('.tab-btn[data-target="tab-general"]'));
    },

    closeSettings() {
        this.dom.settingsContent.classList.remove('scale-100', 'opacity-100');
        this.dom.settingsContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            this.dom.settingsModal.classList.add('hidden');
        }, 300);
    },

    switchSettingsTab(btnNode) {
        // Смена активного класса
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('active', 'text-white');
            b.classList.add('text-gray-400');
        });
        btnNode.classList.add('active', 'text-white');
        btnNode.classList.remove('text-gray-400');

        // Показ контента
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        const targetId = btnNode.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');

        // Показывать кнопку сохранения только для Базы знаний
        if (targetId === 'tab-prompts') {
            this.dom.settingsFooter.classList.remove('hidden');
        } else {
            this.dom.settingsFooter.classList.add('hidden');
        }
    },

    renderSettingsScript() {
        this.dom.replicasList.innerHTML = '';
        this.tempScript.forEach((text, index) => {
            this.dom.replicasList.appendChild(this.createReplicaInput(text));
        });
        lucide.createIcons({ root: this.dom.replicasList });
    },

    createReplicaInput(text) {
        const div = document.createElement('div');
        div.className = "flex gap-2 group items-start";
        div.innerHTML = `
            <textarea class="flex-1 bg-bgDark border border-borderDark rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors resize-none h-20 custom-scrollbar" placeholder="Введите ответ ИИ...">${this.escapeHTML(text)}</textarea>
            <button class="text-gray-500 hover:text-red-400 p-2 transition-colors shrink-0 delete-btn bg-bgDark border border-borderDark rounded-xl h-10 flex items-center justify-center">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        div.querySelector('.delete-btn').addEventListener('click', () => div.remove());
        return div;
    },

    addReplicaInput() {
        const el = this.createReplicaInput("");
        this.dom.replicasList.appendChild(el);
        lucide.createIcons({ root: el });
        el.querySelector('textarea').focus();
    },

    clearAllReplicas() {
        if(confirm("Удалить все ответы из базы знаний?")) {
            this.dom.replicasList.innerHTML = '';
        }
    },

    saveSettings() {
        const textareas = this.dom.replicasList.querySelectorAll('textarea');
        const newScript = Array.from(textareas).map(t => t.value.trim()).filter(v => v);
        StorageAPI.saveScript(newScript);
        this.closeSettings();
    },

    deleteAllChats() {
        if(confirm("Внимание! Это удалит всю историю диалогов. Продолжить?")) {
            StorageAPI.deleteAllChats();
            this.activeChat = StorageAPI.createChat();
            this.renderSidebar();
            this.renderChat();
            this.closeSettings();
        }
    },

    // --- Utils ---

    toggleMobileMenu(show) {
        if (show) {
            this.dom.sidebar.classList.remove('-translate-x-full');
            this.dom.sidebarOverlay.classList.remove('hidden');
        } else {
            this.dom.sidebar.classList.add('-translate-x-full');
            this.dom.sidebarOverlay.classList.add('hidden');
        }
    },

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({'&': '&amp;','<': '&lt;','>': '&gt;',"'": '&#39;','"': '&quot;'}[tag] || tag)
        );
    }
};

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});
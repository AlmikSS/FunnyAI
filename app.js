/**
 * CCG AI - Core Application Logic
 * Обновлено: Индивидуальное время ответа, UI в стиле Gemini, исправление настроек.
 */

// ==========================================
// 1. Data Models & Storage
// ==========================================
const StorageAPI = {
    // Теперь скрипт - это массив объектов {text: string, delay: number}
    DEFAULT_SCRIPT: [
        { text: "Анализ архитектуры завершен. Авторитативный сервер настроен корректно.", delay: 1.5 },
        { text: "Для оптимизации вычислений в Unity рекомендую перенести этот LINQ запрос в кэш. Garbage Collector может вызывать фризы.", delay: 3.0 },
        { text: "Сгенерировал C# сервис для потоковой передачи. Интеграция с ONNX Runtime успешна.", delay: 2.2 },
        { text: "Задержка предсказания клиента (Client Prediction) снижена на 14мс.", delay: 1.8 }
    ],

    getScript() {
        const data = localStorage.getItem('ccg_script_v2');
        if (data) {
            return JSON.parse(data);
        }
        
        // Миграция старых строковых данных, если они есть
        const oldData = localStorage.getItem('ccg_script');
        if (oldData) {
            const parsed = JSON.parse(oldData);
            if (typeof parsed[0] === 'string') {
                const migrated = parsed.map(text => ({ text, delay: 1.5 }));
                this.saveScript(migrated);
                return migrated;
            }
        }
        return this.DEFAULT_SCRIPT;
    },

    saveScript(scriptArray) {
        localStorage.setItem('ccg_script_v2', JSON.stringify(scriptArray));
    },

    // ЧАТЫ
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
            title: 'Новый чат',
            messages: [],
            scriptIndex: 0
        };
        chats.unshift(newChat);
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
            const script = StorageAPI.getScript();
            const chat = StorageAPI.getChat(chatId);
            
            if (!chat) return resolve({ text: "Ошибка контекста.", time: 0 });
            if (script.length === 0) return resolve({ text: "База данных пуста.", time: 0 });

            let index = chat.scriptIndex || 0;
            if (index >= script.length) index = 0;

            const replica = script[index];
            const delaySeconds = parseFloat(replica.delay) || 1.0;
            const delayMs = delaySeconds * 1000;
            
            // Запоминаем следующий шаг
            chat.scriptIndex = index + 1;
            StorageAPI.updateChat(chat);

            setTimeout(() => {
                resolve({ text: replica.text, time: delaySeconds });
            }, delayMs);
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
            
            // Настройки
            settingsModal: document.getElementById('settingsModal'),
            settingsContent: document.getElementById('settingsContent'),
            openSettingsBtn: document.getElementById('openSettingsBtn'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            addReplicaBtn: document.getElementById('addReplicaBtn'),
            clearAllReplicasBtn: document.getElementById('clearAllReplicasBtn'),
            replicasList: document.getElementById('replicasList'),
            deleteAllChatsBtn: document.getElementById('deleteAllChatsBtn'),
            
            // Мобилка
            sidebar: document.getElementById('sidebar'),
            mobileMenuBtn: document.getElementById('mobileMenuBtn'),
            sidebarOverlay: document.getElementById('sidebarOverlay')
        };
    },

    bindEvents() {
        this.dom.sendBtn.addEventListener('click', () => this.sendMessage());
        this.dom.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.dom.messageInput.addEventListener('input', () => this.autoResizeTextarea());
        
        this.dom.newChatBtn.addEventListener('click', () => this.handleNewChat());
        
        this.dom.openSettingsBtn.addEventListener('click', () => this.openSettings());
        document.querySelectorAll('.close-settings').forEach(btn => {
            btn.addEventListener('click', () => this.closeSettings());
        });
        
        this.dom.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.dom.addReplicaBtn.addEventListener('click', () => this.addReplicaInput());
        this.dom.clearAllReplicasBtn.addEventListener('click', () => this.clearAllReplicas());
        this.dom.deleteAllChatsBtn.addEventListener('click', () => this.deleteAllChats());

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSettingsTab(e.currentTarget));
        });

        this.dom.mobileMenuBtn.addEventListener('click', () => this.toggleMobileMenu(true));
        this.dom.sidebarOverlay.addEventListener('click', () => this.toggleMobileMenu(false));
    },

    // --- Логика чата ---

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
            btn.className = `w-full text-left truncate px-4 py-3 rounded-full text-sm transition-all duration-200 ${
                isActive 
                ? 'bg-accent/10 text-accent font-medium' 
                : 'text-gray-300 hover:bg-borderDark'
            }`;
            btn.textContent = chat.title;
            btn.onclick = () => this.switchChat(chat.id);
            this.dom.chatList.appendChild(btn);
        });
    },

    renderChat() {
        this.dom.chatContainer.innerHTML = '';
        
        if (!this.activeChat || this.activeChat.messages.length === 0) {
            this.dom.chatContainer.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center select-none opacity-80 mt-10">
                    <h2 class="text-3xl font-medium mb-2 bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">Привет!</h2>
                    <p class="text-gray-400">Введи любой текст для начала симуляции.</p>
                </div>
            `;
            return;
        }

        this.activeChat.messages.forEach(msg => this.appendMessageDOM(msg.role, msg.text, msg.time, false));
        this.scrollToBottom();
    },

    async sendMessage() {
        const text = this.dom.messageInput.value.trim();
        if (!text) return;

        if (this.activeChat.messages.length === 0) {
            this.activeChat.title = text.length > 30 ? text.substring(0, 30) + '...' : text;
            this.dom.chatContainer.innerHTML = ''; 
        }

        this.dom.messageInput.value = '';
        this.autoResizeTextarea();
        this.dom.messageInput.disabled = true;
        this.dom.sendBtn.classList.add('opacity-30');

        // Пользователь (без аватара, Gemini-style)
        this.activeChat.messages.push({ role: 'user', text });
        StorageAPI.updateChat(this.activeChat);
        this.renderSidebar();
        this.appendMessageDOM('user', text, null, true);
        this.scrollToBottom();

        // Индикатор набора ИИ
        const typingId = this.showTypingIndicator();
        this.scrollToBottom();

        // Генерация
        const response = await AIService.generateResponse(this.activeChat.id);

        this.removeTypingIndicator(typingId);
        
        // Бот
        this.activeChat.messages.push({ role: 'bot', text: response.text, time: response.time });
        StorageAPI.updateChat(this.activeChat);
        this.appendMessageDOM('bot', response.text, response.time, true);

        this.dom.messageInput.disabled = false;
        this.dom.sendBtn.classList.remove('opacity-30');
        this.dom.messageInput.focus();
        this.scrollToBottom();
    },

    appendMessageDOM(role, text, time, animate) {
        const wrapper = document.createElement('div');
        const animClass = animate ? 'message-appear' : '';
        wrapper.className = `w-full max-w-4xl mx-auto flex ${role === 'user' ? 'justify-end' : 'justify-start'} ${animClass}`;
        
        if (role === 'user') {
            wrapper.innerHTML = `
                <div class="bg-userBubble px-5 py-3.5 rounded-3xl rounded-tr-sm max-w-[85%] md:max-w-[75%] text-gray-100 shadow-sm">
                    <p class="whitespace-pre-wrap leading-relaxed text-[15px]">${this.escapeHTML(text)}</p>
                </div>
            `;
        } else {
            // AI Message (Gemini style: Icon on left, plain text block)
            const timeHTML = time ? `<div class="text-[11px] text-gray-500 mt-3 font-mono flex items-center gap-1.5"><i data-lucide="clock" class="w-3 h-3"></i> ${time} с</div>` : '';
            wrapper.innerHTML = `
                <div class="flex items-start gap-4 max-w-[95%]">
                    <div class="mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        <i data-lucide="sparkles" class="w-6 h-6 text-accent"></i>
                    </div>
                    <div class="flex-1 pt-1">
                        <div class="text-gray-100 leading-relaxed whitespace-pre-wrap text-[15px]">${this.escapeHTML(text)}</div>
                        ${timeHTML}
                    </div>
                </div>
            `;
        }
        
        this.dom.chatContainer.appendChild(wrapper);
        lucide.createIcons({ root: wrapper });
    },

    showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const wrapper = document.createElement('div');
        wrapper.id = id;
        wrapper.className = "w-full max-w-4xl mx-auto flex justify-start message-appear";
        
        wrapper.innerHTML = `
            <div class="flex items-start gap-4">
                <div class="mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                    <i data-lucide="sparkles" class="w-6 h-6 text-accent"></i>
                </div>
                <div class="flex-1 pt-1.5">
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
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

    // --- Настройки ---

    openSettings() {
        this.dom.settingsModal.classList.remove('hidden');
        this.tempScript = JSON.parse(JSON.stringify(StorageAPI.getScript())); // Deep copy
        this.renderSettingsScript();
        this.switchSettingsTab(document.querySelector('.tab-btn[data-target="tab-prompts"]'));
    },

    closeSettings() {
        this.dom.settingsModal.classList.add('hidden');
    },

    switchSettingsTab(btnNode) {
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('active', 'text-white', 'bg-panelDark');
            b.classList.add('text-gray-400');
        });
        btnNode.classList.add('active', 'text-white', 'bg-panelDark');
        btnNode.classList.remove('text-gray-400');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(btnNode.getAttribute('data-target')).classList.remove('hidden');
    },

    renderSettingsScript() {
        this.dom.replicasList.innerHTML = '';
        this.tempScript.forEach((item) => {
            this.dom.replicasList.appendChild(this.createReplicaInput(item));
        });
        lucide.createIcons({ root: this.dom.replicasList });
    },

    createReplicaInput(item) {
        const div = document.createElement('div');
        div.className = "flex flex-col gap-2 p-4 bg-bgDark border border-borderDark rounded-xl group";
        div.innerHTML = `
            <textarea class="w-full bg-transparent text-sm text-gray-200 focus:outline-none resize-none h-16 custom-scrollbar replica-text" placeholder="Текст ответа...">${this.escapeHTML(item.text)}</textarea>
            <div class="flex items-center justify-between border-t border-borderDark pt-3 mt-1">
                <div class="flex items-center gap-2">
                    <i data-lucide="clock" class="w-4 h-4 text-gray-500"></i>
                    <span class="text-xs text-gray-400">Время ответа (сек):</span>
                    <input type="number" step="0.1" min="0" value="${item.delay}" class="w-16 bg-panelDark border border-borderDark rounded text-xs px-2 py-1 text-white outline-none focus:border-accent replica-delay">
                </div>
                <button class="text-gray-500 hover:text-red-400 transition-colors delete-btn">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        div.querySelector('.delete-btn').addEventListener('click', () => div.remove());
        return div;
    },

    addReplicaInput() {
        const el = this.createReplicaInput({ text: "", delay: 1.5 });
        this.dom.replicasList.appendChild(el);
        lucide.createIcons({ root: el });
        el.querySelector('textarea').focus();
    },

    clearAllReplicas() {
        if(confirm("Очистить весь сценарий?")) {
            this.dom.replicasList.innerHTML = '';
        }
    },

    saveSettings() {
        const items = Array.from(this.dom.replicasList.children).map(div => {
            return {
                text: div.querySelector('.replica-text').value.trim(),
                delay: parseFloat(div.querySelector('.replica-delay').value) || 0
            };
        }).filter(item => item.text !== "");
        
        StorageAPI.saveScript(items);
        this.closeSettings();
    },

    deleteAllChats() {
        if(confirm("Удалить всю историю?")) {
            StorageAPI.deleteAllChats();
            this.activeChat = StorageAPI.createChat();
            this.renderSidebar();
            this.renderChat();
            this.closeSettings();
        }
    },

    // --- Утилиты ---

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

document.addEventListener('DOMContentLoaded', () => UI.init());
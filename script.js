// ===== SYSTÈME DE CHAT EN TEMPS RÉEL =====
class RealtimeChatManager {
    constructor(authSystem) {
        this.authSystem = authSystem;
        this.currentSalon = null;
        this.subscription = null;
        this.messagesContainer = null;
        this.messageInput = null;
        this.sendButton = null;
        this.recentMessages = new Set();
        this.isSending = false;
        this.initializeElements();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('discussionMessages');
        if (this.messagesContainer) this.messagesContainer.classList.add('discussion-messages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.querySelector('.discussion-input button, .send-button');
    }

    async joinSalon(salonId) {
        console.log(`🚀 Rejoindre le salon: ${salonId}`);
        showSalonConnectionStatus(salonId, 'connecting');

        if (this.subscription) {
            console.log('🔌 Déconnexion de l\'ancien salon...');
            await window.supabaseClient.removeChannel(this.subscription);
        }

        this.currentSalon = salonId;
        await this.loadMessages(salonId);

        this.subscription = window.supabaseClient
            .channel(`salon_${salonId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `salon_id=eq.${salonId}`
            }, payload => {
                console.log('📨 Nouveau message reçu via Realtime:', payload.new);
                this.displayMessage(payload.new);
                playNotificationSound();
            })
            .subscribe();

        showSalonConnectionStatus(salonId, 'connected');
        displaySystemMessage(`Vous avez rejoint ${salonId === 'global' ? 'le chat global' : 'le salon ' + salonId}`);
        console.log(`✅ Connecté au salon ${salonId}`);
    }

    async loadMessages(salonId) {
        try {
            const { data: messages, error } = await window.supabaseClient
                .from('messages')
                .select('*')
                .eq('salon_id', salonId)
                .order('created_at', { ascending: true })
                .limit(50);

            if (error) throw error;

            if (this.messagesContainer) {
                this.messagesContainer.innerHTML = '';
                this.recentMessages.clear();
                messages.forEach(message => this.displayMessage(message));
                this.scrollToBottom();
            }
        } catch (error) {
            console.error('Erreur lors du chargement des messages:', error);
        }
    }

    displayMessage(message) {
        if (!this.messagesContainer) return;

        const messageKey = `${message.user_id}-${message.content}-${message.created_at}`;
        console.log('📋 Tentative d\'affichage du message:', messageKey);

        if (this.recentMessages.has(messageKey)) {
            console.log('🚫 Message doublon détecté et ignoré:', messageKey);
            return;
        }

        console.log('✅ Nouveau message valide, affichage en cours...');
        this.recentMessages.add(messageKey);

        setTimeout(() => {
            this.recentMessages.delete(messageKey);
        }, 10000);

        const messageElement = document.createElement('div');
        const isOwnMessage = message.user_id === this.authSystem.currentUser?.email;
        messageElement.className = `message ${isOwnMessage ? 'user' : 'other'}`;

        const messageTime = new Date(message.created_at).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const userInitial = message.user_name ? message.user_name.charAt(0).toUpperCase() : 'U';
        const teamColor = this.getTeamColor(message.user_team);

        messageElement.innerHTML = `
            <div class="message-wrapper">
                <div class="message-avatar" style="background: ${teamColor}">${userInitial}</div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">${message.user_name}</span>
                        <span class="message-timestamp">${messageTime}</span>
                        ${message.user_team ? `<span class="message-team">${this.getTeamName(message.user_team)}</span>` : ''}
                    </div>
                    <div class="message-text">${this.formatMessageContent(message.content)}</div>
                </div>
            </div>
        `;

        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
        console.log('🎯 Message affiché avec succès dans l\'interface');
    }

    async sendMessage() {
        if (this.isSending || !this.messageInput || !this.currentSalon || !this.authSystem.currentUser) {
            console.log('🚫 Envoi déjà en cours ou données manquantes');
            return;
        }

        const content = this.messageInput.value.trim();
        if (!content) return;

        console.log('📤 Envoi du message:', content);
        this.isSending = true;

        if (this.sendButton) {
            this.sendButton.classList.add('clicked');
            this.sendButton.disabled = true;
        }

        this.messageInput.disabled = true;

        const messageData = {
            user_id: this.authSystem.currentUser.email,
            user_name: this.authSystem.currentUser.nickname || this.authSystem.currentUser.firstName,
            user_team: this.authSystem.currentUser.favoriteTeam,
            salon_id: this.currentSalon,
            content: content,
            created_at: new Date().toISOString()
        };

        try {
            console.log('💾 Insertion en base de données...', messageData);
            const { data, error } = await window.supabaseClient
                .from('messages')
                .insert([messageData]);

            if (error) throw error;

            this.messageInput.value = '';

            if (this.sendButton) {
                const originalBackground = this.sendButton.style.background;
                setTimeout(() => {
                    this.sendButton.style.background = 'linear-gradient(135deg, #00ff88, #00cc66)';
                    setTimeout(() => {
                        this.sendButton.style.background = originalBackground;
                    }, 300);
                }, 100);
            }

            console.log('✅ Message envoyé avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de l\'envoi du message:', error);
            alert('Erreur lors de l\'envoi du message');
        } finally {
            this.messageInput.disabled = false;
            if (this.sendButton) {
                this.sendButton.disabled = false;
                setTimeout(() => {
                    this.sendButton.classList.remove('clicked');
                }, 600);
            }
            this.messageInput.focus();
            updateSendButtonState();
            setTimeout(() => {
                this.isSending = false;
            }, 1000);
        }
    }

    getTeamColor(team) {
        const teamColors = {
            ferrari: '#DC143C',
            mercedes: '#00D2BE',
            redbull: '#0066CC',
            mclaren: '#FF8700',
            astonmartin: '#006F62',
            alpine: '#FF6BCD',
            williams: '#00A0E6',
            haas: '#FF0000',
            visacashapp: '#0066CC',
            stake: '#00FF00'
        };
        return teamColors[team] || '#666666';
    }

    getTeamName(team) {
        const teamNames = {
            ferrari: 'Ferrari',
            mercedes: 'Mercedes',
            redbull: 'Red Bull',
            mclaren: 'McLaren',
            astonmartin: 'Aston Martin',
            alpine: 'Alpine',
            williams: 'Williams',
            haas: 'Haas',
            visacashapp: 'Visa Cash App',
            stake: 'Stake F1'
        };
        return teamNames[team] || '';
    }

    formatMessageContent(content) {
        const div = document.createElement('div');
        div.textContent = content;
        let escapedContent = div.innerHTML;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        escapedContent = escapedContent.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        return escapedContent;
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    async leaveSalon() {
        if (this.subscription) {
            await window.supabaseClient.removeChannel(this.subscription);
            this.subscription = null;
        }
        this.currentSalon = null;
        console.log('Salon quitté');
    }

    async cleanup() {
        await this.leaveSalon();
    }
}

// ===== GESTION DE L'AUTHENTIFICATION =====
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('raceToWinUsers') || '[]');
        this.initializeEventListeners();
        this.checkAuthStatus();
        this.initializeChatManager();
    }

    initializeChatManager() {
        setTimeout(() => {
            if (this.currentUser) {
                chatManager = new RealtimeChatManager(this);
                console.log('Chat manager initialisé');
                setTimeout(() => {
                    initSendButtonEffects();
                }, 500);
            }
        }, 1000);
    }

    initializeEventListeners() {
        document.getElementById('loginForm')?.addEventListener('submit', async e => {
            e.preventDefault();
            const email = e.target.querySelector('input[type="email"]').value;
            const password = e.target.querySelector('input[type="password"]').value;
            await this.login(email, password);
        });

        document.getElementById('registerForm')?.addEventListener('submit', async e => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const userData = {
                firstName: formData.get('firstName'),
                email: formData.get('email'),
                nickname: formData.get('nickname'),
                password: formData.get('password'),
                favoriteTeam: this.getSelectedTeam(),
                isPremium: false,
                createdAt: new Date().toISOString()
            };
            await this.register(userData);
        });

        document.querySelectorAll('.team-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.team-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            });
        });

        document.querySelectorAll('.discussion-card').forEach(card => {
            const team = card.dataset.team;
            const chatType = card.dataset.chat;
            card.addEventListener('click', () => {
                this.openChat(chatType, team);
            });
        });

        setTimeout(() => {
            this.setupProfileButton();
        }, 100);
    }

    setupProfileButton() {
        const profileButton = document.getElementById('profileButton');

        if (profileButton) {
            profileButton.replaceWith(profileButton.cloneNode(true));
            const newProfileButton = document.getElementById('profileButton');

            newProfileButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                openProfilePage(); // Ouvre directement la page moderne
            });
        }
    }


    getSelectedTeam() {
        const selected = document.querySelector('.team-option.selected');
        return selected ? selected.dataset.team : null;
    }

    async login(email, password) {
        const user = await window.login(email, password);
        if (user) {
            this.currentUser = user;
            localStorage.setItem('raceToWinCurrentUser', JSON.stringify(user));
            this.showMainApp();
            this.updateProfileUI();
            this.updateChatAccess();
            setTimeout(() => {
                this.setupProfileButton();
                initSendButtonEffects();
            }, 200);
        }
    }

    async register(userData) {
        const user = await window.register(userData);
        if (user) {
            this.currentUser = user;
            localStorage.setItem('raceToWinCurrentUser', JSON.stringify(user));
            this.showMainApp();
            this.updateProfileUI();
            this.updateChatAccess();
            setTimeout(() => {
                this.setupProfileButton();
                initSendButtonEffects();
            }, 200);
        }
    }

    checkAuthStatus() {
        const savedUser = localStorage.getItem('raceToWinCurrentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showMainApp();
            this.updateProfileUI();
            this.updateChatAccess();
            setTimeout(() => {
                this.setupProfileButton();
                initSendButtonEffects();
            }, 200);
        } else {
            this.showAuthPage();
        }
    }

    showAuthPage() {
        document.getElementById('authOverlay').style.display = 'flex';
        document.getElementById('mainApp').classList.remove('show');
    }

    showMainApp() {
        document.getElementById('authOverlay').style.display = 'none';
        document.getElementById('mainApp').classList.add('show');

        if (!chatManager && this.currentUser) {
            chatManager = new RealtimeChatManager(this);
            setTimeout(() => {
                initSendButtonEffects();
            }, 500);
        }
    }

    updateProfileUI() {
        if (!this.currentUser) return;

        const initial = this.currentUser.firstName.charAt(0).toUpperCase();
        const profileImage = this.currentUser.profile_image;

        console.log('🔄 Mise à jour interface profil - Image:', profileImage ? 'OUI' : 'NON');

        const profileButton = document.getElementById('profileButton');
        if (profileButton) {
            if (profileImage && profileImage.startsWith('data:image/')) {
                profileButton.innerHTML = `
                    <img src="${profileImage}"
                         alt="Profil"
                         style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
                `;
                console.log('✅ Bouton profil mis à jour avec image');
            } else {
                profileButton.textContent = initial;
                profileButton.style.fontSize = '20px';
                console.log('✅ Bouton profil mis à jour avec initiale');
            }
        }

        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) {
            if (profileImage && profileImage.startsWith('data:image/')) {
                profileAvatar.innerHTML = `
                    <img src="${profileImage}"
                         alt="Profil"
                         style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
                `;
            } else {
                profileAvatar.textContent = initial;
                profileAvatar.style.fontSize = '24px';
            }
        }

        const profileMainAvatar = document.getElementById('profileMainAvatar');
        if (profileMainAvatar) {
            if (profileImage && profileImage.startsWith('data:image/')) {
                profileMainAvatar.innerHTML = `
                    <img src="${profileImage}"
                         alt="Profil"
                         style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
                `;
            } else {
                profileMainAvatar.textContent = initial;
                profileMainAvatar.style.fontSize = '48px';
            }
        }

        this.updateChatAvatars();

        const profileName = document.getElementById('profileName');
        const profileMainName = document.getElementById('profileMainName');

        if (profileName) {
            profileName.textContent = `${this.currentUser.firstName} ${this.currentUser.nickname ? '(' + this.currentUser.nickname + ')' : ''}`;
        }

        if (profileMainName) {
            profileMainName.textContent = `${this.currentUser.firstName} ${this.currentUser.nickname ? '(' + this.currentUser.nickname + ')' : ''}`;
        }

        const teamNames = {
            ferrari: 'Ferrari',
            mercedes: 'Mercedes',
            redbull: 'Red Bull',
            mclaren: 'McLaren',
            astonmartin: 'Aston Martin',
            alpine: 'Alpine',
            williams: 'Williams',
            haas: 'Haas',
            visacashapp: 'Visa Cash App',
            stake: 'Stake F1'
        };

        const teamName = teamNames[this.currentUser.favoriteTeam] || 'Aucune équipe';

        const profileTeam = document.getElementById('profileTeam');
        const profileMainTeam = document.getElementById('profileMainTeam');

        if (profileTeam) {
            profileTeam.textContent = teamName;
        }

        if (profileMainTeam) {
            profileMainTeam.innerHTML = `<span>🏎️</span><span>${teamName}</span>`;
        }

        const premiumBtn = document.getElementById('premiumBtn');
        if (premiumBtn) {
            if (this.currentUser.isPremium) {
                premiumBtn.textContent = '⭐ Premium Actif';
                premiumBtn.style.background = 'linear-gradient(135deg, #FFD700, #FFA500)';
                premiumBtn.style.color = '#000';
            } else {
                premiumBtn.textContent = '⭐ Passer Premium';
                premiumBtn.style.background = '';
                premiumBtn.style.color = '';
            }
        }

        console.log('🎯 Interface profil complètement mise à jour');
    }

    updateChatAvatars() {
        if (!this.currentUser) return;

        const userEmail = this.currentUser.email;
        const profileImage = this.currentUser.profile_image;
        const initial = this.currentUser.firstName.charAt(0).toUpperCase();

        console.log('💬 Mise à jour avatars chat pour:', userEmail);

        const userMessages = document.querySelectorAll('.message.user');
        userMessages.forEach(message => {
            const avatar = message.querySelector('.message-avatar');
            if (avatar) {
                if (profileImage && profileImage.startsWith('data:image/')) {
                    avatar.innerHTML = `
                        <img src="${profileImage}"
                             alt="Mon profil"
                             style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
                    `;
                } else {
                    avatar.innerHTML = initial;
                    avatar.style.fontSize = '16px';
                    avatar.style.display = 'flex';
                    avatar.style.alignItems = 'center';
                    avatar.style.justifyContent = 'center';
                }
            }
        });

        console.log(`✅ ${userMessages.length} avatars de chat mis à jour`);
    }

    updateProfilePageData() {
        if (!this.currentUser) return;

        const initial = this.currentUser.firstName.charAt(0).toUpperCase();
        const profileImage = this.currentUser.profile_image;

        const mainAvatar = document.getElementById('profileMainAvatar');
        if (mainAvatar) {
            if (profileImage && profileImage.startsWith('data:image/')) {
                mainAvatar.innerHTML = `
                    <img src="${profileImage}"
                         alt="Profil"
                         style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
                `;
            } else {
                mainAvatar.textContent = initial;
            }
        }

        const mainName = document.getElementById('profileMainName');
        if (mainName) {
            mainName.textContent = `${this.currentUser.firstName} ${this.currentUser.nickname ? '(' + this.currentUser.nickname + ')' : ''}`;
        }

        const mainTeam = document.getElementById('profileMainTeam');
        if (mainTeam) {
            const teamNames = {
                ferrari: 'Ferrari',
                mercedes: 'Mercedes',
                redbull: 'Red Bull',
                mclaren: 'McLaren',
                astonmartin: 'Aston Martin',
                alpine: 'Alpine',
                williams: 'Williams',
                haas: 'Haas',
                visacashapp: 'Visa Cash App',
                stake: 'Stake F1'
            };
            mainTeam.innerHTML = `<span>🏎️</span><span>${teamNames[this.currentUser.favoriteTeam] || 'Aucune équipe'}</span>`;
        }

        const mainEmail = document.getElementById('profileMainEmail');
        if (mainEmail) {
            mainEmail.textContent = this.currentUser.email;
        }

        const joinDate = document.querySelector('.profile-join-date');
        if (joinDate && this.currentUser.createdAt) {
            const date = new Date(this.currentUser.createdAt);
            const options = { year: 'numeric', month: 'long' };
            joinDate.textContent = `Membre depuis ${date.toLocaleDateString('fr-FR', options)}`;
        }

        this.updateProfileStats();
    }

    updateProfileStats() {
        const stats = {
            messages: Math.floor(Math.random() * 200) + 50,
            games: Math.floor(Math.random() * 50) + 10,
            accuracy: Math.floor(Math.random() * 30) + 70,
            victories: Math.floor(Math.random() * 20) + 5
        };

        const statElements = document.querySelectorAll('.profile-stat-value');
        if (statElements.length >= 4) {
            statElements[0].textContent = stats.messages;
            statElements[1].textContent = stats.games;
            statElements[2].textContent = stats.accuracy + '%';
            statElements[3].textContent = stats.victories;
        }
    }

    updateChatAccess() {
        if (!this.currentUser) return;

        const userTeam = this.currentUser.favoriteTeam;
        const isPremium = this.currentUser.isPremium;

        const userTeamCard = document.querySelector(`[data-team="${userTeam}"]`);
        if (userTeamCard) {
            userTeamCard.classList.remove('locked');
        }

        if (isPremium) {
            document.querySelectorAll('.discussion-card.locked').forEach(card => {
                card.classList.remove('locked');
                const teamId = card.dataset.team;
                if (teamId) {
                    const premiumBadge = document.getElementById(`${teamId}-premium`);
                    if (premiumBadge) {
                        premiumBadge.classList.remove('hidden');
                    }
                }
            });
        } else {
            document.querySelectorAll('.discussion-card.locked').forEach(card => {
                const teamId = card.dataset.team;
                if (teamId && teamId !== userTeam) {
                    const premiumBadge = document.getElementById(`${teamId}-premium`);
                    if (premiumBadge) {
                        premiumBadge.classList.remove('hidden');
                    }
                }
            });
        }

        const premiumCards = document.querySelectorAll('.discussion-card.premium');
        const nonPremiumCards = document.querySelectorAll('.discussion-card:not(.premium)');

        if (premiumCards.length > 0 && nonPremiumCards.length > 0) {
            const separator = document.createElement('div');
            separator.className = 'premium-separator';
            nonPremiumCards[0].parentNode.insertBefore(separator, nonPremiumCards[0]);
        }
    }

    openChat(chatType, teamRequired) {
        if (teamRequired && !this.hasAccessToTeam(teamRequired)) {
            if (this.currentUser.favoriteTeam !== teamRequired) {
                alert('Accès Premium requis pour ce salon d\'équipe');
                return;
            }
        }

        const chatNames = {
            global: 'Chat Global F1',
            ferrari: 'Salon Ferrari',
            mercedes: 'Salon Mercedes',
            redbull: 'Salon Red Bull',
            mclaren: 'Salon McLaren',
            astonmartin: 'Salon Aston Martin',
            alpine: 'Salon Alpine',
            williams: 'Salon Williams',
            haas: 'Salon Haas',
            visacashapp: 'Salon Visa Cash App RB',
            stake: 'Salon Stake F1'
        };

        const teamLogos = {
            global: 'https://1000marcas.net/wp-content/uploads/2020/01/logo-F1.png',
            ferrari: 'https://static.vecteezy.com/system/resources/previews/022/100/924/large_2x/ferrari-logo-transparent-free-png.png',
            mercedes: 'https://www.freepnglogos.com/uploads/mercedes-logo-png/mercedes-logo-mercedes-benz-logo-png-transparent-svg-vector-bie-13.png',
            redbull: 'https://upload.wikimedia.org/wikipedia/fr/thumb/3/36/Red_Bull_Racing_2022.png/250px-Red_Bull_Racing_2022.png',
            mclaren: 'https://cdn3.emoji.gg/emojis/9807_McLaren_Logo.png',
            astonmartin: 'https://companieslogo.com/img/orig/AML.L_BIG-8f60d295.png?t=1720244490',
            alpine: 'https://brandlogo.org/wp-content/uploads/2024/04/Alpine-Cars-Logo-300x300.png.webp',
            williams: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Logo_Williams_F1.png',
            haas: 'https://logodownload.org/wp-content/uploads/2022/03/haas-f1-team-logo-0.png',
            stake: 'https://bettingapps-com.imgix.net/assets/local/stake-logo-white.png?auto=compress%2Cformat&fit=clip&q=75&w=380&s=165f66c291ad3df8714146f3e039c4c6',
            visacashapp: 'https://cdn.prod.website-files.com/61b372525d9e220633140352/65df7c39bce657df7423a0af_Visa_Cash_App_RB_team_logo.webp'
        };

        const teamNames = {
            global: 'Chat Global F1',
            ferrari: 'Salon Ferrari',
            mercedes: 'Salon Mercedes',
            redbull: 'Salon Red Bull',
            mclaren: 'Salon McLaren',
            astonmartin: 'Salon Aston Martin',
            alpine: 'Salon Alpine',
            williams: 'Salon Williams',
            haas: 'Salon Haas',
            visacashapp: 'Salon Visa Cash App RB',
            stake: 'Salon Stake F1'
        };

        const logoUrl = teamLogos[chatType] || teamLogos.global;
        const teamName = teamNames[chatType] || 'Chat F1';

        console.log(`🏎️ Équipe: ${chatType} | Logo: ${logoUrl} | Nom: ${teamName}`);

        const discussionHeader = document.querySelector('.discussion-header');
        if (discussionHeader) {
            discussionHeader.innerHTML = `
                <div class="discussion-header-content">
                    <img src="${logoUrl}" alt="${teamName}" class="discussion-header-logo">
                    <div class="discussion-header-status">
                        <div class="status-dot"></div>
                        <span>En ligne</span>
                    </div>
                </div>
            `;
        }

        console.log('✅ Header mis à jour avec le logo centré');
        this.applyTeamColors(chatType, teamRequired);

        if (chatManager) {
            const salonId = teamRequired || chatType;
            chatManager.joinSalon(salonId);
        }

        setTimeout(() => {
            initSendButtonEffects();
        }, 500);

        showTab('discussion');
    }

    applyTeamColors(chatType, teamRequired) {
        const discussionContainer = document.querySelector('.discussion-container');
        if (discussionContainer) {
            discussionContainer.removeAttribute('data-team');
            const teamToApply = teamRequired || chatType;
            discussionContainer.setAttribute('data-team', teamToApply);
            this.updateDiscussionHeader(chatType, teamToApply);
        }
    }

    updateDiscussionHeader(chatType, team) {
        const headerAvatar = document.querySelector('.discussion-header-avatar');
        const headerTitle = document.querySelector('.discussion-header-title');
        const headerSubtitle = document.querySelector('.discussion-header-subtitle');

        const teamInfo = {
            global: {
                emoji: '🌍',
                name: 'Chat Global F1',
                subtitle: 'Discussion générale Formula 1'
            },
            ferrari: {
                emoji: '🏎️',
                name: 'Salon Ferrari',
                subtitle: 'Forza Ferrari! Scuderia'
            },
            mercedes: {
                emoji: '⭐',
                name: 'Salon Mercedes',
                subtitle: 'Mercedes-AMG Petronas F1'
            },
            redbull: {
                emoji: '🔵',
                name: 'Salon Red Bull',
                subtitle: 'Oracle Red Bull Racing'
            },
            mclaren: {
                emoji: '🧡',
                name: 'Salon McLaren',
                subtitle: 'McLaren F1 Team'
            },
            astonmartin: {
                emoji: '💚',
                name: 'Salon Aston Martin',
                subtitle: 'Aston Martin Aramco'
            },
            alpine: {
                emoji: '🇫🇷',
                name: 'Salon Alpine',
                subtitle: 'BWT Alpine F1 Team'
            },
            williams: {
                emoji: '💙',
                name: 'Salon Williams',
                subtitle: 'Williams Racing'
            },
            haas: {
                emoji: '🔴',
                name: 'Salon Haas',
                subtitle: 'MoneyGram Haas F1 Team'
            },
            visacashapp: {
                emoji: '🟦',
                name: 'Salon Visa Cash App RB',
                subtitle: 'Visa Cash App RB F1 Team'
            },
            stake: {
                emoji: '🟢',
                name: 'Salon Stake F1',
                subtitle: 'Stake F1 Team Kick Sauber'
            }
        };

        const info = teamInfo[team] || teamInfo.global;

        if (headerAvatar) headerAvatar.textContent = info.emoji;
        if (headerTitle) headerTitle.textContent = info.name;
        if (headerSubtitle) headerSubtitle.textContent = info.subtitle;
    }

    hasAccessToTeam(teamId) {
        return this.currentUser.isPremium || this.currentUser.favoriteTeam === teamId;
    }

    logout() {
        if (chatManager) {
            chatManager.cleanup();
            chatManager = null;
        }

        this.currentUser = null;
        localStorage.removeItem('raceToWinCurrentUser');
        this.showAuthPage();
        closeProfilePage();
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
        document.querySelectorAll('.team-option.selected').forEach(option => {
            option.classList.remove('selected');
        });
    }
}

// ===== PAGE PROFIL AVEC SWIPE FLUIDE POUR FERMER =====

// Variables globales pour le swipe
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let touchCurrentY = 0;
let isDragging = false;
let swipeThreshold = 80; // Distance minimum réduite pour plus de réactivité
let swipeVelocityThreshold = 0.3; // Seuil de vitesse réduit
let startTime = 0;

function openProfilePage() {
    console.log('openProfilePage - avec swipe gauche fluide pour fermer');
    const overlay = document.getElementById('profilePageOverlay');
    const menu = document.querySelector('.menu');

    if (overlay) {
        // 1. PRÉPARER L'OVERLAY
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.transform = 'translateX(-100%)';
        overlay.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
        overlay.style.willChange = 'transform';

        // 2. CACHER LE MENU
        if (menu) {
            menu.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease';
            menu.style.transform = 'translateY(100%)';
            menu.style.opacity = '0';
            menu.style.pointerEvents = 'none';
        }

        // 3. ANIMER DEPUIS LA GAUCHE
        setTimeout(() => {
            overlay.classList.add('show');
            overlay.style.transform = 'translateX(0)';
        }, 50);

        // 4. AJOUTER LES EVENT LISTENERS POUR LE SWIPE
        addSwipeListeners(overlay);

        document.body.style.overflow = 'hidden';

        if (authSystem && authSystem.currentUser) {
            authSystem.updateProfilePageData();
        }

        console.log('Profile ouvert - swipe gauche fluide activé');
    }
}

function closeProfilePage(isSwipeClose = false) {
    console.log('closeProfilePage - animation fluide vers la gauche');
    const overlay = document.getElementById('profilePageOverlay');
    const menu = document.querySelector('.menu');

    if (overlay) {
        // 1. SUPPRIMER LES EVENT LISTENERS
        removeSwipeListeners(overlay);

        // 2. ANIMER VERS LA GAUCHE avec courbe plus fluide
        const transition = isSwipeClose 
            ? 'transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.4s ease-out'
            : 'transform 0.5s cubic-bezier(0.55, 0.085, 0.68, 0.53)';

        overlay.style.transition = transition;
        overlay.style.transform = 'translateX(-100%)';
        overlay.style.opacity = isSwipeClose ? '0' : '1';

        // 3. REMONTER LE MENU avec délai adapté
        const menuDelay = isSwipeClose ? 100 : 200;
        setTimeout(() => {
            if (menu) {
                menu.style.pointerEvents = 'auto';
                menu.style.transition = 'transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.6s ease';
                menu.style.transform = 'translateY(0)';
                menu.style.opacity = '1';
            }
        }, menuDelay);

        // 4. NETTOYER avec délai adapté
        const cleanupDelay = isSwipeClose ? 400 : 500;
        setTimeout(() => {
            overlay.classList.remove('show');
            overlay.style.display = 'none';
            overlay.style.transform = '';
            overlay.style.transition = '';
            overlay.style.willChange = '';
            overlay.style.opacity = '';
        }, cleanupDelay);

        document.body.style.overflow = 'auto';

        console.log('Profile fermé avec animation fluide');
    }
}

// ===== FONCTIONS DE GESTION DU SWIPE AMÉLIORÉES =====

function addSwipeListeners(overlay) {
    // Touch events pour mobile
    overlay.addEventListener('touchstart', handleTouchStart, { passive: false });
    overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
    overlay.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Mouse events pour desktop (optionnel)
    overlay.addEventListener('mousedown', handleMouseStart);
    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('mouseup', handleMouseEnd);
    overlay.addEventListener('mouseleave', handleMouseEnd);

    console.log('✅ Swipe listeners fluides ajoutés');
}

function removeSwipeListeners(overlay) {
    // Touch events
    overlay.removeEventListener('touchstart', handleTouchStart);
    overlay.removeEventListener('touchmove', handleTouchMove);
    overlay.removeEventListener('touchend', handleTouchEnd);

    // Mouse events
    overlay.removeEventListener('mousedown', handleMouseStart);
    overlay.removeEventListener('mousemove', handleMouseMove);
    overlay.removeEventListener('mouseup', handleMouseEnd);
    overlay.removeEventListener('mouseleave', handleMouseEnd);

    console.log('🗑️ Swipe listeners supprimés');
}

// ===== GESTION TOUCH OPTIMISÉE (MOBILE) =====

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchCurrentX = touchStartX;
    touchCurrentY = touchStartY;
    isDragging = false;
    startTime = Date.now();

    const overlay = document.getElementById('profilePageOverlay');
    if (overlay) {
        overlay.style.transition = 'none'; // Supprimer transition pendant le drag
        overlay.style.willChange = 'transform, opacity'; // Optimiser les performances
    }
}

function handleTouchMove(e) {
    if (!isDragging) {
        touchCurrentX = e.touches[0].clientX;
        touchCurrentY = e.touches[0].clientY;

        const deltaX = touchCurrentX - touchStartX;
        const deltaY = Math.abs(touchCurrentY - touchStartY);

        // Vérifier si c'est un swipe horizontal vers la gauche (seuil réduit)
        if (Math.abs(deltaX) > 5 && deltaY < 30 && deltaX < 0) {
            isDragging = true;
            e.preventDefault(); // Empêcher le scroll
        }
    }

    if (isDragging) {
        touchCurrentX = e.touches[0].clientX;
        const deltaX = touchCurrentX - touchStartX;

        // Seulement si on swipe vers la gauche
        if (deltaX < 0) {
            const overlay = document.getElementById('profilePageOverlay');
            if (overlay) {
                // Courbe d'atténuation pour un mouvement plus naturel
                const progress = Math.min(Math.abs(deltaX) / window.innerWidth, 1);
                const easedProgress = easeOutCubic(progress);

                // Transformation plus fluide avec résistance progressive
                const resistance = 0.8; // Réduire la résistance pour plus de fluidité
                const translateX = deltaX * resistance;

                overlay.style.transform = `translateX(${translateX}px)`;
                overlay.style.opacity = 1 - (easedProgress * 0.4); // Opacité plus douce
            }
        }
        e.preventDefault();
    }
}

function handleTouchEnd(e) {
    if (isDragging) {
        const deltaX = touchCurrentX - touchStartX;
        const deltaTime = Date.now() - startTime;
        const velocity = Math.abs(deltaX) / deltaTime;

        const overlay = document.getElementById('profilePageOverlay');
        if (overlay) {
            // Logique de fermeture améliorée
            const distanceThreshold = Math.abs(deltaX) > swipeThreshold;
            const velocityThreshold = velocity > swipeVelocityThreshold;
            const minimumDistance = Math.abs(deltaX) > 40; // Distance minimum absolue

            const shouldClose = (distanceThreshold || velocityThreshold) && deltaX < 0 && minimumDistance;

            if (shouldClose) {
                // FERMER avec animation fluide
                console.log('🚀 Swipe fluide détecté - fermeture rapide');

                // Animation de fermeture immédiate et fluide
                overlay.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease-out';
                overlay.style.transform = 'translateX(-100%)';
                overlay.style.opacity = '0';

                // Finaliser la fermeture
                setTimeout(() => {
                    closeProfilePage(true);
                }, 50);

            } else {
                // REMETTRE EN PLACE avec animation élastique
                overlay.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease-out';
                overlay.style.transform = 'translateX(0)';
                overlay.style.opacity = '1';

                // Remettre willChange après l'animation
                setTimeout(() => {
                    overlay.style.willChange = 'auto';
                }, 400);
            }
        }
    }

    isDragging = false;
}

// ===== GESTION MOUSE OPTIMISÉE (DESKTOP) =====

function handleMouseStart(e) {
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    touchCurrentX = touchStartX;
    touchCurrentY = touchStartY;
    isDragging = false;
    startTime = Date.now();

    const overlay = document.getElementById('profilePageOverlay');
    if (overlay) {
        overlay.style.transition = 'none';
        overlay.style.cursor = 'grabbing';
        overlay.style.willChange = 'transform, opacity';
    }
}

function handleMouseMove(e) {
    if (e.buttons === 1) { // Bouton gauche pressé
        if (!isDragging) {
            touchCurrentX = e.clientX;
            touchCurrentY = e.clientY;

            const deltaX = touchCurrentX - touchStartX;
            const deltaY = Math.abs(touchCurrentY - touchStartY);

            if (Math.abs(deltaX) > 5 && deltaY < 30 && deltaX < 0) {
                isDragging = true;
            }
        }

        if (isDragging) {
            touchCurrentX = e.clientX;
            const deltaX = touchCurrentX - touchStartX;

            if (deltaX < 0) {
                const overlay = document.getElementById('profilePageOverlay');
                if (overlay) {
                    const progress = Math.min(Math.abs(deltaX) / window.innerWidth, 1);
                    const easedProgress = easeOutCubic(progress);
                    const resistance = 0.8;
                    const translateX = deltaX * resistance;

                    overlay.style.transform = `translateX(${translateX}px)`;
                    overlay.style.opacity = 1 - (easedProgress * 0.4);
                }
            }
        }
    }
}

function handleMouseEnd(e) {
    if (isDragging) {
        const deltaX = touchCurrentX - touchStartX;
        const deltaTime = Date.now() - startTime;
        const velocity = Math.abs(deltaX) / deltaTime;

        const overlay = document.getElementById('profilePageOverlay');
        if (overlay) {
            overlay.style.cursor = 'default';

            const shouldClose = (Math.abs(deltaX) > swipeThreshold || velocity > swipeVelocityThreshold) 
                               && deltaX < 0 && Math.abs(deltaX) > 40;

            if (shouldClose) {
                console.log('🖱️ Drag fluide détecté - fermeture rapide');

                overlay.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease-out';
                overlay.style.transform = 'translateX(-100%)';
                overlay.style.opacity = '0';

                setTimeout(() => {
                    closeProfilePage(true);
                }, 50);

            } else {
                overlay.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease-out';
                overlay.style.transform = 'translateX(0)';
                overlay.style.opacity = '1';

                setTimeout(() => {
                    overlay.style.willChange = 'auto';
                }, 400);
            }
        }
    }

    isDragging = false;
}

// ===== FONCTION D'EASING POUR PLUS DE FLUIDITÉ =====

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// ===== VERSION SIMPLIFIÉE ULTRA-FLUIDE (ALTERNATIVE) =====

function addUltraFluidSwipe() {
    const overlay = document.getElementById('profilePageOverlay');
    if (!overlay) return;

    let startX = 0;
    let startTime = 0;

    overlay.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startTime = Date.now();
        overlay.style.willChange = 'transform';
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
        const currentX = e.touches[0].clientX;
        const deltaX = currentX - startX;

        if (deltaX < 0) { // Swipe vers la gauche seulement
            const progress = Math.min(Math.abs(deltaX) / window.innerWidth, 1);
            overlay.style.transform = `translateX(${deltaX * 0.8}px)`;
            overlay.style.opacity = 1 - (progress * 0.3);
        }
    }, { passive: true });

    overlay.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const deltaX = endX - startX;
        const deltaTime = Date.now() - startTime;
        const velocity = Math.abs(deltaX) / deltaTime;

        // Fermeture si swipe > 60px ou vitesse élevée
        if ((Math.abs(deltaX) > 60 || velocity > 0.4) && deltaX < 0) {
            console.log('⚡ Swipe ultra-fluide détecté');

            // Animation de sortie immédiate
            overlay.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.25s ease-out';
            overlay.style.transform = 'translateX(-100%)';
            overlay.style.opacity = '0';

            setTimeout(() => closeProfilePage(true), 50);
        } else {
            // Retour fluide à la position
            overlay.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            overlay.style.transform = 'translateX(0)';
            overlay.style.opacity = '1';
        }

        overlay.style.willChange = 'auto';
    }, { passive: true });

    console.log('⚡ Swipe ultra-fluide activé');
}

// ===== CLASSE PROFILEEDITOR =====
class ProfileEditor {
    constructor(authSystem) {
        this.authSystem = authSystem;
        this.isEditing = false;
        this.currentImageFile = null;
        this.originalData = {};
    }

    editProfile() {
        console.log('🎨 Ouverture de l\'éditeur de profil');
        if (!this.authSystem.currentUser) {
            alert('Erreur: Utilisateur non connecté');
            return;
        }

        this.originalData = {
            nickname: this.authSystem.currentUser.nickname,
            profileImage: this.authSystem.currentUser.profile_image || null
        };

        this.showEditInterface();
    }

    showEditInterface() {
        const existingOverlay = document.getElementById('profileEditOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const overlay = this.createEditOverlay();
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            overlay.classList.add('show');
        }, 10);
    }

    createEditOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'profile-edit-overlay';
        overlay.id = 'profileEditOverlay';

        const currentUser = this.authSystem.currentUser;
        const currentImage = currentUser.profile_image || null;
        const currentNickname = currentUser.nickname || '';
        const userInitial = currentUser.firstName.charAt(0).toUpperCase();

        overlay.innerHTML = `
            <div class="profile-edit-container">
                <div class="profile-edit-header">
                    <h2 class="profile-edit-title">Modifier le profil</h2>
                    <button class="profile-edit-close" onclick="window.profileEditor.closeEditInterface()">
                        <span>✕</span>
                    </button>
                </div>
                <div class="profile-edit-content">
                    <div class="profile-image-section">
                        <div class="profile-image-wrapper">
                            <div class="profile-current-image" id="currentProfileImage">
                                ${currentImage ?
                                    `<img src="${currentImage}" alt="Photo de profil" class="profile-img">` :
                                    `<div class="profile-img-placeholder">${userInitial}</div>`
                                }
                            </div>
                            <button class="profile-image-change-btn" onclick="window.profileEditor.triggerImageUpload()">
                                📷
                            </button>
                        </div>
                        <input type="file"
                               id="profileImageInput"
                               accept="image/*"
                               style="display: none;">
                        <p class="profile-image-hint">Cliquez sur l'icône 📷 pour changer votre photo</p>
                    </div>
                    <div class="profile-info-section">
                        <div class="profile-edit-group">
                            <label class="profile-edit-label">Surnom</label>
                            <input type="text"
                                   class="profile-edit-input"
                                   id="nicknameInput"
                                   value="${currentNickname}"
                                   placeholder="Votre surnom"
                                   maxlength="20">
                            <small class="profile-edit-hint">Maximum 20 caractères</small>
                        </div>
                        <div class="profile-edit-group">
                            <label class="profile-edit-label">Prénom</label>
                            <input type="text"
                                   class="profile-edit-input disabled"
                                   value="${currentUser.firstName}"
                                   disabled>
                            <small class="profile-edit-hint">Le prénom ne peut pas être modifié</small>
                        </div>
                        <div class="profile-edit-group">
                            <label class="profile-edit-label">Email</label>
                            <input type="email"
                                   class="profile-edit-input disabled"
                                   value="${currentUser.email}"
                                   disabled>
                            <small class="profile-edit-hint">L'email ne peut pas être modifié</small>
                        </div>
                    </div>
                    <div class="profile-preview-section" id="profilePreviewSection" style="display: none;">
                        <h3 class="profile-preview-title">Aperçu des modifications</h3>
                        <div class="profile-preview-changes" id="profilePreviewChanges"></div>
                    </div>
                </div>
                <div class="profile-edit-actions">
                    <button class="profile-edit-btn secondary" onclick="window.profileEditor.closeEditInterface()">
                        Annuler
                    </button>
                    <button class="profile-edit-btn primary" onclick="window.profileEditor.saveChanges()" id="saveChangesBtn">
                        <span class="save-icon">💾</span>
                        <span class="save-text">Sauvegarder</span>
                    </button>
                </div>
                <div class="profile-loading" id="profileLoading" style="display: none;">
                    <div class="loading-spinner"></div>
                    <p>Sauvegarde en cours...</p>
                </div>
            </div>
        `;

        setTimeout(() => {
            this.attachEventListeners();
        }, 100);

        return overlay;
    }

    attachEventListeners() {
        const imageInput = document.getElementById('profileImageInput');
        const nicknameInput = document.getElementById('nicknameInput');

        if (imageInput) {
            imageInput.addEventListener('change', event => {
                this.handleImageSelect(event);
            });
        }

        if (nicknameInput) {
            nicknameInput.addEventListener('input', () => {
                this.updatePreview();
            });
        }
    }

    triggerImageUpload() {
        const fileInput = document.getElementById('profileImageInput');
        if (fileInput) {
            fileInput.click();
        }
    }

    handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Veuillez sélectionner un fichier image valide');
            return;
        }

        if (file.size > 1024 * 1024) {
            alert('L\'image est trop volumineuse. Taille maximum: 1MB');
            return;
        }

        this.currentImageFile = file;

        const reader = new FileReader();
        reader.onload = e => {
            const currentImageContainer = document.getElementById('currentProfileImage');
            if (currentImageContainer) {
                currentImageContainer.innerHTML = `
                    <img src="${e.target.result}" alt="Nouvelle photo de profil" class="profile-img">
                `;
            }
            this.updatePreview();
        };
        reader.readAsDataURL(file);
    }

    updatePreview() {
        const nicknameInput = document.getElementById('nicknameInput');
        const previewSection = document.getElementById('profilePreviewSection');
        const previewChanges = document.getElementById('profilePreviewChanges');

        if (!nicknameInput || !previewSection || !previewChanges) return;

        const newNickname = nicknameInput.value.trim();
        const hasImageChange = this.currentImageFile !== null;
        const hasNicknameChange = newNickname !== this.originalData.nickname;

        if (hasImageChange || hasNicknameChange) {
            let changesHTML = '<ul class="changes-list">';

            if (hasImageChange) {
                changesHTML += '<li class="change-item">📷 Photo de profil modifiée</li>';
            }

            if (hasNicknameChange) {
                changesHTML += `<li class="change-item">✏️ Surnom: "${this.originalData.nickname}" → "${newNickname}"</li>`;
            }

            changesHTML += '</ul>';

            previewChanges.innerHTML = changesHTML;
            previewSection.style.display = 'block';
        } else {
            previewSection.style.display = 'none';
        }
    }

    async uploadProfileImage(file) {
        console.log('📸 Conversion Base64...');

        if (!file.type.startsWith('image/')) {
            throw new Error('Sélectionnez une image (JPG, PNG, GIF)');
        }

        if (file.size > 1024 * 1024) {
            throw new Error('Image trop grande (max 1MB)');
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                console.log('✅ Image convertie en Base64');
                resolve(reader.result);
            };
            reader.onerror = () => reject(new Error('Erreur de lecture'));
            reader.readAsDataURL(file);
        });
    }

    async saveChanges() {
        const nicknameInput = document.getElementById('nicknameInput');
        const saveBtn = document.getElementById('saveChangesBtn');
        const loadingIndicator = document.getElementById('profileLoading');

        if (!nicknameInput) return;

        const newNickname = nicknameInput.value.trim();

        if (newNickname.length === 0) {
            alert('Le surnom ne peut pas être vide');
            return;
        }

        if (newNickname.length > 20) {
            alert('Surnom trop long (max 20 caractères)');
            return;
        }

        const hasImageChange = this.currentImageFile !== null;
        const hasNicknameChange = newNickname !== (this.authSystem.currentUser.nickname || '');

        if (!hasImageChange && !hasNicknameChange) {
            alert('Aucun changement à sauvegarder');
            return;
        }

        saveBtn.disabled = true;
        loadingIndicator.style.display = 'flex';

        try {
            let profileImageData = this.authSystem.currentUser.profile_image;

            if (hasImageChange) {
                console.log('📤 Traitement image...');
                profileImageData = await this.uploadProfileImage(this.currentImageFile);
            }

            console.log('💾 Sauvegarde en base...');

            const { error } = await window.supabaseClient
                .from('users')
                .update({
                    nickname: newNickname,
                    profile_image: profileImageData
                })
                .eq('email', this.authSystem.currentUser.email);

            if (error) {
                throw new Error('Erreur sauvegarde: ' + error.message);
            }

            this.authSystem.currentUser.nickname = newNickname;
            this.authSystem.currentUser.profile_image = profileImageData;

            localStorage.setItem('raceToWinCurrentUser', JSON.stringify(this.authSystem.currentUser));
            this.authSystem.updateProfileUI();
            this.authSystem.updateChatAvatars();

            this.showSuccessMessage();
            setTimeout(() => {
                this.closeEditInterface();
            }, 1500);

        } catch (error) {
            console.error('❌ Erreur:', error);
            alert('Erreur: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            loadingIndicator.style.display = 'none';
        }
    }

    showSuccessMessage() {
        const saveBtn = document.getElementById('saveChangesBtn');
        if (saveBtn) {
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<span>✅</span><span>Sauvegardé !</span>';
            saveBtn.style.background = 'linear-gradient(135deg, #00ff88, #00cc66)';
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.style.background = '';
            }, 1500);
        }
    }

    closeEditInterface() {
        const overlay = document.getElementById('profileEditOverlay');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
                document.body.style.overflow = 'auto';
            }, 300);
        }

        this.currentImageFile = null;
        this.originalData = {};
    }
}

// ===== FONCTIONS UTILITAIRES POUR LE CHAT =====
function displaySystemMessage(message) {
    if (!chatManager || !chatManager.messagesContainer) return;
    const messageElement = document.createElement('div');
    messageElement.className = 'message system';
    messageElement.innerHTML = `<div class="message-text">${message}</div>`;
    chatManager.messagesContainer.appendChild(messageElement);
    chatManager.scrollToBottom();
}

function showSalonConnectionStatus(salonId, status = 'connecting') {
    const discussionMessages = document.getElementById('discussionMessages');
    if (!discussionMessages) return;

    const existingStatus = discussionMessages.querySelector('.salon-connection-status');
    if (existingStatus) {
        existingStatus.remove();
    }

    const statusElement = document.createElement('div');
    statusElement.className = `salon-connection-status ${status}`;

    const salonNames = {
        global: 'Chat Global F1',
        ferrari: 'Salon Ferrari',
        mercedes: 'Salon Mercedes',
        redbull: 'Salon Red Bull',
        mclaren: 'Salon McLaren',
        astonmartin: 'Salon Aston Martin',
        alpine: 'Salon Alpine',
        williams: 'Salon Williams',
        haas: 'Salon Haas',
        visacashapp: 'Salon Visa Cash App RB',
        stake: 'Salon Stake F1'
    };

    const salonName = salonNames[salonId] || salonId;

    if (status === 'connecting') {
        statusElement.textContent = `🔄 Connexion à ${salonName}...`;
    } else if (status === 'connected') {
        statusElement.textContent = `✅ Connecté à ${salonName}`;
    } else if (status === 'error') {
        statusElement.textContent = `❌ Erreur de connexion à ${salonName}`;
    }

    discussionMessages.insertBefore(statusElement, discussionMessages.firstChild);

    if (status === 'connected') {
        setTimeout(() => {
            if (statusElement.parentNode) {
                statusElement.remove();
            }
        }, 3000);
    }
}

function getOnlineUsersCount(salonId) {
    return Math.floor(Math.random() * 50) + 10;
}

function getTimeAgo(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInSeconds = Math.floor((now - messageDate) / 1000);

    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)}min`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)}h`;
    return messageDate.toLocaleDateString('fr-FR');
}

function playNotificationSound() {
    console.log('🔔 Nouveau message reçu');
}

// ===== VARIABLES GLOBALES =====
let authSystem;
let currentReactionGame = null;
let chatManager = null;
let profileEditor = null;

// ===== FONCTIONS GLOBALES =====
function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tabName + 'Form').classList.add('active');
}

// Fonction pour ramener en haut de page avec animation fluide
function scrollToTop() {
    // Scroll fluide vers le haut
    window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
    });

    // Fallback pour navigateurs plus anciens
    if (document.documentElement.scrollTop !== 0 || document.body.scrollTop !== 0) {
        window.scrollTo(0, 0);
    }

    // Forcer aussi sur les conteneurs avec scroll
    const scrollContainers = document.querySelectorAll('.content, .tab-content, .container, .discussion-messages');
    scrollContainers.forEach(container => {
        if (container) {
            container.scrollTop = 0;
        }
    });
}

function showTab(tabName) {
    // Vérifiez si l'élément avec l'ID tabName existe
    const tabContent = document.getElementById(tabName);
    if (!tabContent) {
        console.error(`L'élément avec l'ID ${tabName} n'existe pas.`);
        return;
    }
    // Vérifiez si les éléments avec la classe tab-content existent
    const tabs = document.querySelectorAll('.tab-content');
    if (tabs.length === 0) {
        console.error("Aucun élément avec la classe 'tab-content' trouvé.");
        return;
    }
    // Retirez la classe 'active' de tous les onglets
    tabs.forEach(tab => {
        if (tab) {
            tab.classList.remove('active');
        }
    });
    // Ajoutez la classe 'active' à l'onglet sélectionné
    tabContent.classList.add('active');
    // Vérifiez si les éléments avec la classe menu-item existent
    const menuItems = document.querySelectorAll('.menu-item');
    if (menuItems.length === 0) {
        console.error("Aucun élément avec la classe 'menu-item' trouvé.");
        return;
    }
    // Retirez la classe 'active' de tous les éléments de menu
    menuItems.forEach(item => {
        if (item) {
            item.classList.remove('active');
        }
    });
    // Ajoutez la classe 'active' à l'élément de menu correspondant
    menuItems.forEach(item => {
        if ((tabName === 'news' && item.textContent.includes('Actualités')) ||
            (tabName === 'discussion-selection' && item.textContent.includes('Salons')) ||
            (tabName === 'jeux' && item.textContent.includes('Jeux'))) {
            item.classList.add('active');
        }
    });

    // RAMENER EN HAUT DE PAGE - AJOUTÉ ICI
    setTimeout(() => {
        scrollToTop();
    }, 50); // Petit délai pour laisser le changement d'onglet se faire

    if (tabName === 'discussion-selection' || tabName === 'discussion') {
        setTimeout(() => {
            initSendButtonEffects();
        }, 200);
    }
}

function openReactionGame() {
    const gameOverlay = document.getElementById('gameOverlay');
    const gameContainer = document.getElementById('reactionGameContainer');
    gameOverlay.style.display = 'block';
    currentReactionGame = new ReactionGame(gameContainer);
}

function closeReactionGame() {
    const gameOverlay = document.getElementById('gameOverlay');
    gameOverlay.style.display = 'none';
    if (currentReactionGame) {
        currentReactionGame.destroy();
        currentReactionGame = null;
    }
}

function initializeDiscussionInterface() {
    const discussionContainer = document.querySelector('.discussion-container');
    if (discussionContainer && !discussionContainer.querySelector('.discussion-header-avatar')) {
        const header = discussionContainer.querySelector('.discussion-header');
        if (header && !header.querySelector('.discussion-header-avatar')) {
            header.innerHTML = `
                <div class="discussion-header-avatar">🌍</div>
                <div class="discussion-header-info">
                    <div class="discussion-header-title">Chat Global F1</div>
                    <div class="discussion-header-subtitle">Discussion générale Formula 1</div>
                </div>
                <div class="discussion-header-status">
                    <div class="status-dot"></div>
                    <span>En ligne</span>
                </div>
            `;
        }

        const inputWrapper = discussionContainer.querySelector('.input-wrapper');
        if (inputWrapper && !inputWrapper.querySelector('.input-icon')) {
            const input = inputWrapper.querySelector('input');
            if (input) {
                inputWrapper.innerHTML = `
                    <div class="input-icon">💬</div>
                    ${input.outerHTML}
                `;
            }
        }
    }
}

function initSendButtonEffects() {
    const messageInput = document.querySelector('#messageInput, .discussion-input input');
    const sendButton = document.querySelector('.send-button, .discussion-input button');

    if (!messageInput || !sendButton) {
        console.log('⚠️ Éléments du bouton d\'envoi non trouvés');
        return;
    }

    console.log('✨ Initialisation des effets du bouton d\'envoi');
    messageInput.addEventListener('input', function() {
        updateSendButtonState();
    });

    updateSendButtonState();
}

function updateSendButtonState() {
    const messageInput = document.querySelector('#messageInput, .discussion-input input');
    const sendButton = document.querySelector('.send-button, .discussion-input button');

    if (!messageInput || !sendButton) return;

    const hasContent = messageInput.value.trim().length > 0;

    if (hasContent) {
        sendButton.classList.add('has-content');
        sendButton.disabled = false;
    } else {
        sendButton.classList.remove('has-content');
        sendButton.disabled = true;
    }
}

function showNotificationSettings() {
    alert('Paramètres de notifications à implémenter');
    closeProfilePage();
}

function showSettings() {
    alert('Paramètres généraux à implémenter');
    closeProfilePage();
}

function upgradeToPremium() {
    if (authSystem && authSystem.currentUser && authSystem.currentUser.isPremium) {
        alert('Vous êtes déjà Premium !');
        return;
    }

    if (confirm('Passer à Premium pour 4,99€/mois ?\n\n✅ Accès à tous les salons d\'équipes\n✅ Fonctionnalités exclusives\n✅ Support prioritaire')) {
        if (authSystem && authSystem.currentUser) {
            authSystem.currentUser.isPremium = true;

            const users = JSON.parse(localStorage.getItem('raceToWinUsers') || '[]');
            const userIndex = users.findIndex(u => u.id === authSystem.currentUser.id);
            if (userIndex !== -1) {
                users[userIndex].isPremium = true;
                localStorage.setItem('raceToWinUsers', JSON.stringify(users));
            }
            localStorage.setItem('raceToWinCurrentUser', JSON.stringify(authSystem.currentUser));

            authSystem.updateProfileUI();
            authSystem.updateChatAccess();
            alert('Félicitations ! Vous êtes maintenant Premium 🎉');
        }
    }
    closeProfilePage();
}

function logout() {
    if (authSystem) {
        authSystem.logout();
    }
}

function openDiscussion(discussionName) {
    const discussionHeader = document.getElementById('discussionHeader');
    discussionHeader.textContent = `💬 ${discussionName.charAt(0).toUpperCase() + discussionName.slice(1)}`;
    showTab('discussion');
}

function sendMessage() {
    if (chatManager) {
        chatManager.sendMessage();
    } else {
        console.error('Chat manager non initialisé');
        if (authSystem && authSystem.currentUser) {
            chatManager = new RealtimeChatManager(authSystem);
            chatManager.sendMessage();
        }
    }
}

function initializeRealtimeChat() {
    if (authSystem && authSystem.currentUser && !chatManager) {
        chatManager = new RealtimeChatManager(authSystem);
        console.log('Chat temps réel initialisé après connexion');
        setTimeout(() => {
            initSendButtonEffects();
        }, 500);
    }
}

// ===== FONCTION RSS CORRIGÉE =====

async function fetchRSSFeed() {
    const rssUrl = 'https://fr.motorsport.com/rss/f1/news/';

    try {
        console.log('📰 Récupération du flux RSS F1...');

        // Afficher un indicateur de chargement
        const feedContainer = document.getElementById('rss-feed');
        if (feedContainer) {
            feedContainer.innerHTML = `
                <div class="swiper-slide">
                    <div class="news-card loading">
                        <div class="loading-content">
                            <div class="loading-spinner"></div>
                            <p>Chargement des actualités F1...</p>
                        </div>
                    </div>
                </div>
            `;
        }

        // Configuration de la requête avec timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 secondes

        const requestUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        console.log('🌐 URL de requête:', requestUrl);

        const response = await fetch(requestUrl, {
            signal: controller.signal,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📊 Données RSS reçues:', data);

        // Vérifier la structure de la réponse
        if (!data) {
            throw new Error('Aucune donnée reçue');
        }

        if (data.status === 'error') {
            throw new Error(`Erreur API: ${data.message || 'Erreur inconnue'}`);
        }

        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Format de réponse invalide - pas d\'articles trouvés');
        }

        if (data.items.length === 0) {
            throw new Error('Aucun article trouvé dans le flux RSS');
        }

        console.log(`✅ ${data.items.length} articles récupérés`);

        // Nettoyer le container
        if (feedContainer) {
            feedContainer.innerHTML = '';
        }

        // Traiter et afficher les articles
        const validArticles = data.items
            .filter(item => item && item.title && item.pubDate)
            .slice(0, 10); // Limiter à 10 articles

        if (validArticles.length === 0) {
            throw new Error('Aucun article valide trouvé');
        }

        validArticles.forEach((item, index) => {
            try {
                const slide = createNewsSlide(item, index);
                if (slide && feedContainer) {
                    feedContainer.appendChild(slide);
                }
            } catch (error) {
                console.warn(`⚠️ Erreur création slide ${index}:`, error);
            }
        });

        // Initialiser ou réinitialiser Swiper
        initializeSwiper();

        console.log(`🎯 ${validArticles.length} articles affichés avec succès`);

    } catch (error) {
        console.error('❌ Erreur récupération RSS:', error);
        handleRSSError(error);
    }
}

function createNewsSlide(item, index) {
    try {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';

        const newsCard = document.createElement('div');
        newsCard.className = 'news-card';

        // Traitement de l'image
        let imageHtml = '<div class="news-image news-image-fallback">🏎️</div>';

        if (item.enclosure && item.enclosure.link) {
            const imageUrl = item.enclosure.link;
            imageHtml = `
                <img src="${imageUrl}"
                     alt="${escapeHtml(item.title)}"
                     class="news-image"
                     onerror="this.parentElement.innerHTML='<div class=&quot;news-image news-image-fallback&quot;>🏎️</div>';"
                     loading="lazy">
            `;
        } else if (item.thumbnail) {
            const imageUrl = item.thumbnail;
            imageHtml = `
                <img src="${imageUrl}"
                     alt="${escapeHtml(item.title)}"
                     class="news-image"
                     onerror="this.parentElement.innerHTML='<div class=&quot;news-image news-image-fallback&quot;>🏎️</div>';"
                     loading="lazy">
            `;
        }

        // Nettoyage et formatage du contenu
        const title = cleanAndTruncateText(item.title, 80);
        const description = cleanAndTruncateText(item.description || item.content || '', 120);
        const pubDate = formatDate(item.pubDate);

        // Créer le lien sécurisé
        const articleUrl = item.link || '#';
        if (articleUrl === '#') {
            console.warn('URL manquante pour l\'article:', item.title);
        }

        newsCard.innerHTML = `
            <div class="news-image-container">
                ${imageHtml}
            </div>
            <div class="news-content">
                <div class="news-title">${title}</div>
                <div class="news-meta">
                    <span class="news-date">${pubDate}</span>
                    <span class="news-source">Motorsport.com</span>
                </div>
                <div class="news-excerpt">${description}</div>
                <div class="news-actions">
                   <button class="news-read-btn" onclick="openExternalArticle('${escapeHtml(articleUrl)}', '${escapeHtml(title)}')" style="background-color: rgba(74, 0, 115, 0.7); color: white; border: none; padding: 5px 20px; border-radius: 8px; height: 30px;">
                        Lire l'article →
                    </button>
                </div>
            </div>
        `;

        slide.appendChild(newsCard);
        return slide;

    } catch (error) {
        console.error('❌ Erreur création slide:', error);
        return null;
    }
}

function cleanAndTruncateText(text, maxLength = 100) {
    if (!text || typeof text !== 'string') return '';

    // Nettoyer le HTML et les entités
    const cleaned = text
        .replace(/<[^>]*>/g, '') // Supprimer les balises HTML
        .replace(/&[^;]+;/g, ' ') // Supprimer les entités HTML
        .replace(/\s+/g, ' ') // Normaliser les espaces
        .trim();

    // Tronquer si nécessaire
    if (cleaned.length <= maxLength) {
        return cleaned;
    }

    return cleaned.substring(0, maxLength - 3).trim() + '...';
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Date inconnue';
        }

        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) {
            return 'À l\'instant';
        } else if (diffHours < 24) {
            return `Il y a ${diffHours}h`;
        } else if (diffDays < 7) {
            return `Il y a ${diffDays}j`;
        } else {
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short'
            });
        }
    } catch (error) {
        console.warn('⚠️ Erreur formatage date:', error);
        return 'Date inconnue';
    }
}

function handleRSSError(error) {
    console.error('🚨 Gestion erreur RSS:', error);

    const feedContainer = document.getElementById('rss-feed');
    if (!feedContainer) return;

    const errorMessage = getErrorMessage(error);

    feedContainer.innerHTML = `
        <div class="swiper-slide">
            <div class="news-card error">
                <div class="error-content">
                    <div class="error-icon">⚠️</div>
                    <h3>Erreur de chargement</h3>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="retryRSSFeed()">
                        🔄 Réessayer
                    </button>
                </div>
            </div>
        </div>
    `;
}

function getErrorMessage(error) {
    if (error.name === 'AbortError') {
        return 'Délai d\'attente dépassé. Vérifiez votre connexion internet.';
    } else if (error.message.includes('HTTP')) {
        return 'Erreur de connexion au serveur RSS.';
    } else if (error.message.includes('Aucun article')) {
        return 'Aucun article disponible pour le moment.';
    } else {
        return 'Erreur temporaire. Veuillez réessayer plus tard.';
    }
}

function retryRSSFeed() {
    console.log('🔄 Nouvelle tentative de chargement RSS...');
    fetchRSSFeed();
}

function openExternalArticle(url, title) {
    if (!url || url === '#') {
        console.warn('⚠️ URL d\'article invalide');
        alert('L\'URL de l\'article est invalide.');
        return;
    }

    try {
        // Ouvrir dans un nouvel onglet
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');

        if (!newWindow) {
            // Si le popup est bloqué, essayer une autre méthode
            console.warn('⚠️ Popup bloqué, utilisation de location.href');
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        console.log('📖 Article ouvert:', title);
    } catch (error) {
        console.error('❌ Erreur ouverture article:', error);
        alert('Impossible d\'ouvrir l\'article. Veuillez réessayer.');
    }
}


let swiperInstance = null;

function initializeSwiper() {
    try {
        // Détruire l'instance précédente si elle existe
        if (swiperInstance) {
            swiperInstance.destroy(true, true);
            swiperInstance = null;
        }

        // Vérifier que Swiper est disponible
        if (typeof Swiper === 'undefined') {
            console.warn('⚠️ Swiper non disponible, chargement CSS simple');
            fallbackSliderDisplay();
            return;
        }

        // Attendre un peu que le DOM soit mis à jour
        setTimeout(() => {
            const swiperContainer = document.querySelector('.swiper-container');
            const swiperWrapper = document.querySelector('.swiper-wrapper');

            if (!swiperContainer || !swiperWrapper) {
                console.warn('⚠️ Conteneurs Swiper non trouvés');
                return;
            }

            const slides = swiperWrapper.querySelectorAll('.swiper-slide');
            if (slides.length === 0) {
                console.warn('⚠️ Aucune slide trouvée');
                return;
            }

            console.log(`🎠 Initialisation Swiper avec ${slides.length} slides`);

            swiperInstance = new Swiper('.swiper-container', {
                slidesPerView: 1,
                spaceBetween: 15,
                loop: slides.length > 1,
                autoplay: slides.length > 1 ? {
                    delay: 8000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true
                } : false,
                speed: 600,
                effect: 'slide',
                grabCursor: true,
                watchOverflow: true,
                resistance: true,
                resistanceRatio: 0.85,
                breakpoints: {
                    768: {
                        slidesPerView: 1.2,
                        spaceBetween: 20
                    },
                    1024: {
                        slidesPerView: 1.5,
                        spaceBetween: 25
                    }
                },
                on: {
                    init: function() {
                        console.log('✅ Swiper initialisé');
                    },
                    slideChange: function() {
                        console.log('🎠 Slide changée:', this.activeIndex);
                    },
                    error: function(error) {
                        console.error('❌ Erreur Swiper:', error);
                    }
                }
            });

        }, 100);

    } catch (error) {
        console.error('❌ Erreur initialisation Swiper:', error);
        fallbackSliderDisplay();
    }
}

function fallbackSliderDisplay() {
    console.log('🔄 Utilisation du mode d\'affichage alternatif');

    const swiperContainer = document.querySelector('.swiper-container');
    if (swiperContainer) {
        swiperContainer.style.overflow = 'auto';
        swiperContainer.style.scrollBehavior = 'smooth';
    }

    const swiperWrapper = document.querySelector('.swiper-wrapper');
    if (swiperWrapper) {
        swiperWrapper.style.display = 'flex';
        swiperWrapper.style.gap = '15px';
        swiperWrapper.style.padding = '0 20px';
    }
}

// ===== FONCTION DE NETTOYAGE ET RÉINITIALISATION =====

function resetRSSFeed() {
    console.log('🧹 Réinitialisation du flux RSS...');

    if (swiperInstance) {
        swiperInstance.destroy(true, true);
        swiperInstance = null;
    }

    const feedContainer = document.getElementById('rss-feed');
    if (feedContainer) {
        feedContainer.innerHTML = '';
    }
}

// ===== GESTION DES ERREURS GLOBALES =====

window.addEventListener('error', function(event) {
    if (event.message && event.message.includes('rss')) {
        console.error('🚨 Erreur RSS globale:', event.error);
        handleRSSError(event.error);
    }
});

window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message && event.reason.message.includes('rss')) {
        console.error('🚨 Promise RSS rejetée:', event.reason);
        handleRSSError(event.reason);
    }
});

// ===== FONCTION D'INITIALISATION AMÉLIORÉE =====

let rssInitialized = false;
let rssRetryCount = 0;
const MAX_RSS_RETRIES = 3;

async function initRSSFeed() {
    if (rssInitialized) {
        console.log('📰 RSS déjà initialisé');
        return;
    }

    try {
        console.log('🚀 Initialisation du flux RSS F1...');
        rssRetryCount = 0;
        await fetchRSSFeed();
        rssInitialized = true;

        // Programmer les mises à jour automatiques
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                console.log('🔄 Mise à jour automatique RSS...');
                fetchRSSFeed();
            }
        }, 10 * 60 * 1000); // Toutes les 10 minutes

    } catch (error) {
        console.error('❌ Erreur initialisation RSS:', error);

        if (rssRetryCount < MAX_RSS_RETRIES) {
            rssRetryCount++;
            console.log(`🔄 Nouvelle tentative ${rssRetryCount}/${MAX_RSS_RETRIES}...`);
            setTimeout(initRSSFeed, 5000 * rssRetryCount); // Délai progressif
        } else {
            console.error('🚨 Échec définitif du chargement RSS après 3 tentatives');
            handleRSSError(new Error('Impossible de charger les actualités après plusieurs tentatives'));
        }
    }
}

// ===== FONCTIONS UTILITAIRES DE DEBUG =====

window.rssDebug = {
    reload: () => {
        resetRSSFeed();
        rssInitialized = false;
        initRSSFeed();
    },

    status: () => {
        return {
            initialized: rssInitialized,
            retryCount: rssRetryCount,
            swiperActive: !!swiperInstance,
            articlesCount: document.querySelectorAll('.swiper-slide').length
        };
    },

    testError: () => {
        handleRSSError(new Error('Erreur de test'));
    },

    clearAndRetry: () => {
        resetRSSFeed();
        setTimeout(() => {
            rssInitialized = false;
            rssRetryCount = 0;
            initRSSFeed();
        }, 1000);
    }
};

console.log('📰 Module RSS corrigé chargé');
console.log('🛠️ Debug: window.rssDebug');

function openArticle(title, content) {
    document.getElementById('articleTitle').textContent = title;
    document.getElementById('articleContent').textContent = content;
    document.getElementById('articleReader').style.display = 'block';
}

function closeArticle() {
    document.getElementById('articleReader').style.display = 'none';
}

function editProfile() {
    console.log('📝 editProfile() appelée');
    if (!window.profileEditor) {
        console.log('🔧 Initialisation de profileEditor...');
        if (authSystem) {
            window.profileEditor = new ProfileEditor(authSystem);
            console.log('✅ ProfileEditor initialisé');
        } else {
            console.error('❌ authSystem non disponible');
            alert('Erreur: Système d\'authentification non disponible');
            return;
        }
    }
    window.profileEditor.editProfile();
}

function togglePreference(toggle) {
    toggle.classList.toggle('active');
    const label = toggle.previousElementSibling.textContent;
    const isActive = toggle.classList.contains('active');
    console.log(`Préférence "${label}" : ${isActive ? 'activée' : 'désactivée'}`);
    saveUserPreference(label, isActive);
}

function saveUserPreference(preference, value) {
    const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
    preferences[preference] = value;
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
}

function changeTeam() {
    console.log('Changer d\'équipe');
    alert('Fonctionnalité de changement d\'équipe à implémenter');
    closeProfilePage();
}

function viewStats() {
    console.log('Voir les statistiques');
    alert('Page de statistiques détaillées à implémenter');
    closeProfilePage();
}

function changePassword() {
    console.log('Changer le mot de passe');
    alert('Fonctionnalité de changement de mot de passe à implémenter');
    closeProfilePage();
}

function getCurrentUser() {
    if (authSystem && authSystem.currentUser) {
        return {
            username: authSystem.currentUser.firstName || 'Utilisateur',
            email: authSystem.currentUser.email || 'email@example.com',
            team: authSystem.currentUser.favoriteTeam || 'ferrari'
        };
    }
    return {
        username: 'Utilisateur',
        email: 'email@example.com',
        team: 'ferrari'
    };
}

// ===== FONCTION DE TEST =====
window.testProfileUpdate = function() {
    console.log('🧪 Test mise à jour profil...');
    if (authSystem && authSystem.currentUser) {
        authSystem.updateProfileUI();
        console.log('✅ Test terminé - vérifiez votre avatar partout !');
    } else {
        console.error('❌ Aucun utilisateur connecté');
    }
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initialisation de l\'application Race to Win...');

    // Initialisez le système d'authentification
    authSystem = new AuthSystem();

    // Initialisez l'interface de discussion
    setTimeout(() => {
        initializeDiscussionInterface();
    }, 100);

    // Configurez le bouton de profil
    setTimeout(() => {
        const profileButton = document.getElementById('profileButton');
        console.log('Direct profile button check:', profileButton);

        if (profileButton) {
            console.log('Adding direct event listener to profile button');
            profileButton.replaceWith(profileButton.cloneNode(true));

            const newProfileButton = document.getElementById('profileButton');
            if (newProfileButton) {
                newProfileButton.addEventListener('click', function(e) {
                    console.log('Direct profile button clicked!');
                    e.preventDefault();
                    e.stopPropagation();
                    openProfilePage();
                });
            }
        }
    }, 500);

    // Initialisez le chat en temps réel
    setTimeout(() => {
        if (authSystem && authSystem.currentUser && !chatManager) {
            chatManager = new RealtimeChatManager(authSystem);
            console.log('Chat temps réel initialisé au démarrage');
            setTimeout(() => {
                initSendButtonEffects();
            }, 500);
        }
    }, 1500);

    // Configurez l'input de message
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        const newMessageInput = messageInput.cloneNode(true);
        messageInput.parentNode.replaceChild(newMessageInput, messageInput);

        newMessageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                console.log('⌨️ Entrée pressée - envoi via chat manager');
                sendMessage();
            }
        });

        newMessageInput.addEventListener('input', function() {
            updateSendButtonState();
        });

        console.log('🔌 Event listeners uniques ajoutés à l\'input message avec effets');
    }

    // Configurez le bouton d'envoi
    const sendButton = document.querySelector('.discussion-input button, .send-button');
    if (sendButton) {
        const newSendButton = sendButton.cloneNode(true);
        sendButton.parentNode.replaceChild(newSendButton, sendButton);

        newSendButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🖱️ Bouton cliqué - envoi via chat manager');
            sendMessage();
        });

        if (!newSendButton.classList.contains('send-button')) {
            newSendButton.classList.add('send-button');
        }

        console.log('🔌 Event listener unique ajouté au bouton d\'envoi avec effets');
    }

    // Initialisez les effets du bouton d'envoi
    setTimeout(() => {
        initSendButtonEffects();
    }, 2000);

    // Configurez l'overlay de profil
    const profileOverlay = document.getElementById('profilePageOverlay');
    if (profileOverlay) {
        profileOverlay.addEventListener('click', function(e) {
            if (e.target === profileOverlay) {
                closeProfilePage();
            }
        });
    }

    // Gestion de la touche Échap
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('profilePageOverlay');
            if (overlay && overlay.classList.contains('show')) {
                closeProfilePage();
            }
        }
    });

    // Récupérez le flux RSS
    fetchRSSFeed();
    setInterval(fetchRSSFeed, 5 * 60 * 1000);

    // Effets sur les cartes de discussion
    document.querySelectorAll('.discussion-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            const icon = this.querySelector('.card-icon');
            if (icon) {
                icon.style.transform = 'scale(1.1)';
            }
        });

        card.addEventListener('mouseleave', function() {
            const icon = this.querySelector('.card-icon');
            if (icon) {
                icon.style.transform = 'scale(1)';
            }
        });
    });



    // Nettoyage avant de quitter la page
    window.addEventListener('beforeunload', function() {
        if (chatManager) {
            chatManager.cleanup();
        }
    });

    console.log('✨ Application Race to Win initialisée avec OpenF1 API et chat temps réel');
});

// JavaScript pour les onglets saison 2025
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('#season-2025 .tab-button');
    const standingsTables = document.querySelectorAll('#season-2025 .standings-table');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Enlever la classe active de tous les boutons et tableaux
            tabButtons.forEach(btn => btn.classList.remove('active'));
            standingsTables.forEach(table => table.classList.remove('active'));

            // Ajouter la classe active au bouton cliqué
            button.classList.add('active');

            // Afficher le tableau correspondant
            const targetTable = document.getElementById(targetTab + '-table');
            if (targetTable) {
                targetTable.classList.add('active');
            }
        });
    });
});
// Switch entre les tableaux avec effet fade
document.addEventListener('DOMContentLoaded', function() {
    const switchButton = document.getElementById('standingsSwitch');
    const switchText = switchButton?.querySelector('.tab-switch-text');
    const driversTable = document.getElementById('drivers-table');
    const constructorsTable = document.getElementById('constructors-table');

    if (switchButton && switchText) {
        let currentTable = 'drivers';
        let isAnimating = false;

        switchButton.addEventListener('click', () => {
            if (isAnimating) return;

            isAnimating = true;

            // Effet fade out
            switchText.classList.add('fade');

            setTimeout(() => {
                // Changement du contenu
                if (currentTable === 'drivers') {
                    driversTable?.classList.remove('active');
                    constructorsTable?.classList.add('active');
                    switchText.textContent = 'Classement Écuries';
                    currentTable = 'constructors';
                } else {
                    constructorsTable?.classList.remove('active');
                    driversTable?.classList.add('active');
                    switchText.textContent = 'Classement Pilotes';
                    currentTable = 'drivers';
                }

                // Effet fade in
                setTimeout(() => {
                    switchText.classList.remove('fade');
                    isAnimating = false;
                }, 50);
            }, 150); // Au milieu du fade
        });
    }
});
// ===== FONCTIONS DE CONNEXION MISES À JOUR =====
// Pour fonctionner avec les mots de passe hashés par Supabase

/**
 * Fonction de connexion mise à jour
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<Object|null>} - Utilisateur connecté ou null
 */
async function login(email, password) {
    try {
        // Utiliser la fonction SQL pour vérifier le mot de passe
        const { data, error } = await window.supabaseClient
            .rpc('verify_user_password', {
                user_email: email,
                plain_password: password
            });

        if (error) {
            throw new Error('Erreur lors de la vérification: ' + error.message);
        }

        // Si le mot de passe est incorrect
        if (!data) {
            alert('Email ou mot de passe incorrect');
            return null;
        }

        // Si le mot de passe est correct, récupérer les données utilisateur
        const { data: users, error: userError } = await window.supabaseClient
            .from('users')
            .select('id, firstName, email, nickname, favoriteTeam, isPremium, createdAt, profile_image')
            .eq('email', email)
            .limit(1);

        if (userError) {
            throw new Error('Erreur lors de la récupération des données: ' + userError.message);
        }

        if (!users || users.length === 0) {
            alert('Utilisateur non trouvé');
            return null;
        }

        console.log('✅ Connexion réussie');
        return users[0];

    } catch (error) {
        console.error('❌ Erreur lors de la connexion:', error);
        alert('Erreur lors de la connexion: ' + error.message);
        return null;
    }
}

/**
 * Fonction d'inscription mise à jour (reste la même)
 * @param {Object} userData - Données de l'utilisateur
 * @returns {Promise<Object|null>} - Utilisateur créé ou null
 */
async function register(userData) {
    try {
        // Validation des données
        if (!userData.firstName || !userData.email || !userData.password) {
            alert('Veuillez remplir tous les champs obligatoires');
            return null;
        }

        if (userData.password.length < 6) {
            alert('Le mot de passe doit contenir au moins 6 caractères');
            return null;
        }

        // Vérifier si l'utilisateur existe déjà
        const { data: existingUsers, error: checkError } = await window.supabaseClient
            .from('users')
            .select('email')
            .eq('email', userData.email)
            .limit(1);

        if (checkError) {
            throw new Error('Erreur lors de la vérification: ' + checkError.message);
        }

        if (existingUsers && existingUsers.length > 0) {
            alert('Un compte existe déjà avec cet email');
            return null;
        }

        // Préparer les données pour la base
        const userToInsert = {
            firstName: userData.firstName,
            email: userData.email,
            password: userData.password, // Sera automatiquement hashé par le trigger !
            nickname: userData.nickname || null,
            favoriteTeam: userData.favoriteTeam || null,
            isPremium: userData.isPremium || false,
            createdAt: userData.createdAt || new Date().toISOString(),
            profile_image: null
        };

        // Insérer en base (le trigger hashera automatiquement le mot de passe)
        const { data: newUsers, error: insertError } = await window.supabaseClient
            .from('users')
            .insert([userToInsert])
            .select('id, firstName, email, nickname, favoriteTeam, isPremium, createdAt, profile_image');

        if (insertError) {
            throw new Error('Erreur lors de l\'inscription: ' + insertError.message);
        }

        if (!newUsers || newUsers.length === 0) {
            throw new Error('Aucune donnée retournée après insertion');
        }

        console.log('✅ Inscription réussie');
        return newUsers[0];

    } catch (error) {
        console.error('❌ Erreur lors de l\'inscription:', error);
        alert('Erreur lors de l\'inscription: ' + error.message);
        return null;
    }
}

/**
 * Fonction pour changer le mot de passe
 * @param {string} email - Email de l'utilisateur
 * @param {string} currentPassword - Mot de passe actuel
 * @param {string} newPassword - Nouveau mot de passe
 * @returns {Promise<boolean>} - true si le changement réussit
 */
async function changePassword(email, currentPassword, newPassword) {
    try {
        if (newPassword.length < 6) {
            alert('Le nouveau mot de passe doit contenir au moins 6 caractères');
            return false;
        }

        // Vérifier l'ancien mot de passe
        const { data: isValid, error: verifyError } = await window.supabaseClient
            .rpc('verify_user_password', {
                user_email: email,
                plain_password: currentPassword
            });

        if (verifyError) {
            throw new Error('Erreur lors de la vérification: ' + verifyError.message);
        }

        if (!isValid) {
            alert('Mot de passe actuel incorrect');
            return false;
        }

        // Mettre à jour le mot de passe (sera automatiquement hashé par le trigger)
        const { error: updateError } = await window.supabaseClient
            .from('users')
            .update({ password: newPassword })
            .eq('email', email);

        if (updateError) {
            throw new Error('Erreur lors de la mise à jour: ' + updateError.message);
        }

        alert('Mot de passe changé avec succès');
        return true;

    } catch (error) {
        console.error('❌ Erreur lors du changement:', error);
        alert('Erreur lors du changement de mot de passe: ' + error.message);
        return false;
    }
}

/**
 * Fonction pour tester la connexion avec un utilisateur existant
 */
async function testLogin() {
    try {
        // Lister les utilisateurs pour test
        const { data: users, error } = await window.supabaseClient
            .from('users')
            .select('email, firstName')
            .limit(5);

        if (error) {
            console.error('Erreur:', error);
            return;
        }

        console.log('👥 Utilisateurs disponibles pour test:');
        users.forEach(user => {
            console.log(`   - ${user.email} (${user.firstName})`);
        });

        console.log('\n🧪 Pour tester la connexion:');
        console.log('   1. Créez un nouvel utilisateur via le formulaire d\'inscription');
        console.log('   2. Ou utilisez: testLoginWithUser("email@example.com", "motdepasse")');

    } catch (error) {
        console.error('Erreur lors du test:', error);
    }
}

/**
 * Fonction de test pour un utilisateur spécifique
 */
async function testLoginWithUser(email, password) {
    console.log(`🔐 Test de connexion pour: ${email}`);

    const result = await login(email, password);

    if (result) {
        console.log('✅ Connexion réussie!', result);
    } else {
        console.log('❌ Connexion échouée');
    }
}

// ===== MISE À JOUR DES FONCTIONS GLOBALES =====

// Remplacer les anciennes fonctions
window.login = login;
window.register = register;
window.changePassword = changePassword;

// Fonctions de test
window.testLogin = testLogin;
window.testLoginWithUser = testLoginWithUser;

console.log('🔐 Système de connexion mis à jour pour les mots de passe hashés');
console.log('🧪 Testez avec: window.testLogin()');

// ===== MIGRATION DES ANCIENS MOTS DE PASSE EN CLAIR =====

/**
 * Fonction pour migrer les anciens mots de passe non hashés
 * (À utiliser une seule fois)
 */
async function migrateOldPasswords() {
    try {
        console.log('🔄 Migration des anciens mots de passe...');

        // Récupérer tous les utilisateurs avec mots de passe non hashés
        const { data: users, error } = await window.supabaseClient
            .from('users')
            .select('id, email, password');

        if (error) {
            throw new Error('Erreur récupération: ' + error.message);
        }

        let migratedCount = 0;
        let alreadyHashedCount = 0;

        for (const user of users) {
            // Vérifier si déjà hashé (format bcrypt)
            if (user.password.match(/^\$2[aby]?\$\d+\$/)) {
                alreadyHashedCount++;
            } else {
                // Mettre à jour (le trigger se chargera du hashage)
                const { error: updateError } = await window.supabaseClient
                    .from('users')
                    .update({ password: user.password }) // Re-sauvegarder pour déclencher le trigger
                    .eq('id', user.id);

                if (updateError) {
                    console.error(`❌ Erreur migration ${user.email}:`, updateError);
                } else {
                    migratedCount++;
                    console.log(`✅ ${user.email} migré`);
                }
            }
        }

        console.log(`🎯 Migration terminée:`);
        console.log(`   - ${migratedCount} mots de passe migrés`);
        console.log(`   - ${alreadyHashedCount} déjà hashés`);

        alert(`Migration: ${migratedCount} migrés, ${alreadyHashedCount} déjà hashés`);

    } catch (error) {
        console.error('❌ Erreur migration:', error);
        alert('Erreur migration: ' + error.message);
    }
}

window.migrateOldPasswords = migrateOldPasswords;

// ===== SYSTÈME D'AVATARS UNIVERSELS POUR LES DISCUSSIONS =====

/**
 * Cache des avatars utilisateur pour éviter les requêtes répétées
 */
class AvatarCache {
    constructor() {
        this.cache = new Map();
        this.loadingPromises = new Map();
    }

    /**
     * Récupère l'avatar d'un utilisateur (avec cache)
     * @param {string} userEmail - Email de l'utilisateur
     * @returns {Promise<Object>} - Données de l'avatar
     */
    async getUserAvatar(userEmail) {
        // Vérifier le cache
        if (this.cache.has(userEmail)) {
            return this.cache.get(userEmail);
        }

        // Vérifier si on est déjà en train de charger
        if (this.loadingPromises.has(userEmail)) {
            return await this.loadingPromises.get(userEmail);
        }

        // Charger l'avatar
        const loadingPromise = this.loadUserAvatar(userEmail);
        this.loadingPromises.set(userEmail, loadingPromise);

        try {
            const avatar = await loadingPromise;
            this.cache.set(userEmail, avatar);
            this.loadingPromises.delete(userEmail);
            return avatar;
        } catch (error) {
            this.loadingPromises.delete(userEmail);
            throw error;
        }
    }

    /**
     * Charge l'avatar depuis la base de données
     * @param {string} userEmail - Email de l'utilisateur
     * @returns {Promise<Object>} - Données de l'avatar
     */
    async loadUserAvatar(userEmail) {
        try {
            const { data: users, error } = await window.supabaseClient
                .from('users')
                .select('firstName, profile_image, favoriteTeam')
                .eq('email', userEmail)
                .limit(1);

            if (error) {
                throw error;
            }

            if (!users || users.length === 0) {
                // Utilisateur non trouvé, retourner un avatar par défaut
                return {
                    initial: 'U',
                    image: null,
                    teamColor: '#666666'
                };
            }

            const user = users[0];

            return {
                initial: user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U',
                image: user.profile_image,
                teamColor: this.getTeamColor(user.favoriteTeam)
            };

        } catch (error) {
            console.error('Erreur chargement avatar:', error);
            return {
                initial: 'U',
                image: null,
                teamColor: '#666666'
            };
        }
    }

    /**
     * Met à jour le cache pour un utilisateur
     * @param {string} userEmail - Email de l'utilisateur
     * @param {Object} avatarData - Nouvelles données d'avatar
     */
    updateCache(userEmail, avatarData) {
        this.cache.set(userEmail, avatarData);
        // Mettre à jour tous les avatars visibles de cet utilisateur
        this.refreshUserAvatarsInDOM(userEmail, avatarData);
    }

    /**
     * Rafraîchit tous les avatars d'un utilisateur dans le DOM
     * @param {string} userEmail - Email de l'utilisateur
     * @param {Object} avatarData - Données d'avatar
     */
    refreshUserAvatarsInDOM(userEmail, avatarData) {
        // Trouver tous les avatars de cet utilisateur dans les messages
        const messageAvatars = document.querySelectorAll(`[data-user-email="${userEmail}"]`);

        messageAvatars.forEach(avatar => {
            this.updateAvatarElement(avatar, avatarData);
        });
    }

    /**
     * Met à jour un élément avatar avec les nouvelles données
     * @param {HTMLElement} avatarElement - Élément avatar à mettre à jour
     * @param {Object} avatarData - Données d'avatar
     */
    updateAvatarElement(avatarElement, avatarData) {
        if (avatarData.image && avatarData.image.startsWith('data:image/')) {
            avatarElement.innerHTML = `
                <img src="${avatarData.image}"
                     alt="Photo de profil"
                     style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
            `;
        } else {
            avatarElement.innerHTML = avatarData.initial;
            avatarElement.style.fontSize = '14px';
            avatarElement.style.display = 'flex';
            avatarElement.style.alignItems = 'center';
            avatarElement.style.justifyContent = 'center';
        }

        // Mettre à jour la couleur de fond
        avatarElement.style.background = avatarData.teamColor;
    }

    /**
     * Vide le cache (utile lors de la déconnexion)
     */
    clearCache() {
        this.cache.clear();
        this.loadingPromises.clear();
    }

    /**
     * Récupère la couleur d'équipe
     * @param {string} team - Nom de l'équipe
     * @returns {string} - Code couleur
     */
    getTeamColor(team) {
        const teamColors = {
            ferrari: '#DC143C',
            mercedes: '#00D2BE',
            redbull: '#0066CC',
            mclaren: '#FF8700',
            astonmartin: '#006F62',
            alpine: '#FF6BCD',
            williams: '#00A0E6',
            haas: '#FF0000',
            visacashapp: '#0066CC',
            stake: '#00FF00'
        };
        return teamColors[team] || '#666666';
    }
}

// Instance globale du cache d'avatars
const avatarCache = new AvatarCache();

// ===== MODIFICATION DE LA CLASSE REALTIMECHATMANAGER =====

/**
 * Version améliorée de displayMessage avec avatars universels
 */
RealtimeChatManager.prototype.displayMessage = async function(message) {
    if (!this.messagesContainer) return;

    const messageKey = `${message.user_id}-${message.content}-${message.created_at}`;

    if (this.recentMessages.has(messageKey)) {
        return;
    }

    this.recentMessages.add(messageKey);

    setTimeout(() => {
        this.recentMessages.delete(messageKey);
    }, 10000);

    const messageElement = document.createElement('div');
    const isOwnMessage = message.user_id === this.authSystem.currentUser?.email;
    messageElement.className = `message ${isOwnMessage ? 'user' : 'other'}`;

    const messageTime = new Date(message.created_at).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Récupérer l'avatar de l'utilisateur
    let avatarData;
    try {
        avatarData = await avatarCache.getUserAvatar(message.user_id);
    } catch (error) {
        // Fallback en cas d'erreur
        avatarData = {
            initial: message.user_name ? message.user_name.charAt(0).toUpperCase() : 'U',
            image: null,
            teamColor: this.getTeamColor(message.user_team)
        };
    }

    // Créer l'avatar avec les données récupérées
    const avatarContent = avatarData.image && avatarData.image.startsWith('data:image/') 
        ? `<img src="${avatarData.image}" alt="Photo de profil" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">`
        : avatarData.initial;

    messageElement.innerHTML = `
        <div class="message-wrapper">
            <div class="message-avatar" 
                 style="background: ${avatarData.teamColor}"
                 data-user-email="${message.user_id}">
                ${avatarContent}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${message.user_name}</span>
                    <span class="message-timestamp">${messageTime}</span>
                    ${message.user_team ? `<span class="message-team">${this.getTeamName(message.user_team)}</span>` : ''}
                </div>
                <div class="message-text">${this.formatMessageContent(message.content)}</div>
            </div>
        </div>
    `;

    this.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();
};

// ===== FONCTIONS UTILITAIRES =====

/**
 * Fonction pour précharger les avatars des messages existants
 */
async function preloadExistingAvatars() {
    const messageAvatars = document.querySelectorAll('.message-avatar[data-user-email]');
    const uniqueEmails = new Set();

    messageAvatars.forEach(avatar => {
        const email = avatar.getAttribute('data-user-email');
        if (email) {
            uniqueEmails.add(email);
        }
    });

    // Précharger tous les avatars
    const loadPromises = Array.from(uniqueEmails).map(email => 
        avatarCache.getUserAvatar(email).catch(error => {
            console.warn(`Erreur préchargement avatar ${email}:`, error);
        })
    );

    await Promise.all(loadPromises);

    // Mettre à jour les avatars dans le DOM
    messageAvatars.forEach(async avatar => {
        const email = avatar.getAttribute('data-user-email');
        if (email) {
            try {
                const avatarData = await avatarCache.getUserAvatar(email);
                avatarCache.updateAvatarElement(avatar, avatarData);
            } catch (error) {
                console.warn(`Erreur mise à jour avatar ${email}:`, error);
            }
        }
    });
}

/**
 * Fonction appelée lors de la mise à jour d'un profil
 * @param {string} userEmail - Email de l'utilisateur
 * @param {Object} newProfileData - Nouvelles données de profil
 */
function onProfileUpdated(userEmail, newProfileData) {
    const avatarData = {
        initial: newProfileData.firstName ? newProfileData.firstName.charAt(0).toUpperCase() : 'U',
        image: newProfileData.profile_image,
        teamColor: avatarCache.getTeamColor(newProfileData.favoriteTeam)
    };

    avatarCache.updateCache(userEmail, avatarData);
}

/**
 * Fonction pour rafraîchir tous les avatars après reconnexion
 */
async function refreshAllAvatars() {
    avatarCache.clearCache();
    await preloadExistingAvatars();
}

/**
 * Fonction pour mettre à jour l'avatar après modification de profil
 */
function updateCurrentUserAvatar() {
    if (authSystem && authSystem.currentUser) {
        const userData = authSystem.currentUser;
        onProfileUpdated(userData.email, {
            firstName: userData.firstName,
            profile_image: userData.profile_image,
            favoriteTeam: userData.favoriteTeam
        });
    }
}

// ===== MODIFICATION DE LA CLASSE PROFILEEDITOR =====

// Surcharger la méthode saveChanges pour notifier le cache
const originalSaveChanges = ProfileEditor.prototype.saveChanges;
ProfileEditor.prototype.saveChanges = async function() {
    // Appeler la méthode originale
    const result = await originalSaveChanges.call(this);

    // Si la sauvegarde a réussi, mettre à jour le cache
    if (result !== false && this.authSystem.currentUser) {
        updateCurrentUserAvatar();
    }

    return result;
};

// ===== INITIALISATION =====

/**
 * Initialise le système d'avatars universels
 */
function initUniversalAvatars() {
    // Précharger les avatars existants lors de l'ouverture d'un salon
    const originalJoinSalon = RealtimeChatManager.prototype.joinSalon;
    RealtimeChatManager.prototype.joinSalon = async function(salonId) {
        const result = await originalJoinSalon.call(this, salonId);

        // Précharger les avatars après le chargement des messages
        setTimeout(preloadExistingAvatars, 1000);

        return result;
    };

    console.log('🎭 Système d\'avatars universels initialisé');
}

// ===== FONCTIONS GLOBALES =====

// Exposer les fonctions utiles
window.avatarSystem = {
    preloadAvatars: preloadExistingAvatars,
    refreshAll: refreshAllAvatars,
    updateUser: onProfileUpdated,
    clearCache: () => avatarCache.clearCache()
};

// Auto-initialisation
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initUniversalAvatars, 2000);
});

console.log('🎭 Système d\'avatars universels chargé');
console.log('📋 Fonctions disponibles: window.avatarSystem');

// ===== DASHBOARD F1 - VERSION FINALE QUI FONCTIONNE =====

// === CONFIGURATION ===
const F1DASHBOARD_CONFIG = {
    BASE_URL: 'https://f1api.dev/api',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    REFRESH_INTERVAL: 10 * 60 * 1000, // 10 minutes
    COUNTDOWN_INTERVAL: 1000 // 1 seconde
};

const dashboardCache = new Map();

function getDashboardCache(key) {
    const cached = dashboardCache.get(key);
    if (cached && Date.now() - cached.timestamp < F1DASHBOARD_CONFIG.CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

function setDashboardCache(key, data) {
    dashboardCache.set(key, { data, timestamp: Date.now() });
}

async function fetchF1Data(url, cacheKey) {
    const cached = getDashboardCache(cacheKey);
    if (cached) {
        console.log(`🎯 Cache hit: ${cacheKey}`);
        return cached;
    }

    try {
        console.log(`🔄 Requête F1API: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setDashboardCache(cacheKey, data);
        console.log(`✅ Données F1 reçues: ${cacheKey}`);
        return data;
    } catch (error) {
        console.error(`❌ Erreur API F1 ${url}:`, error);
        throw error;
    }
}

// === GESTIONNAIRE PROGRESSION SAISON MODIFIÉ ===
class SeasonProgressManager {
    constructor() {
        this.totalRaces = 0;
        this.completedRaces = 0;
        this.container = document.getElementById('seasonProgressCard');
    }

    async loadSeasonData() {
        if (!this.container) {
            console.warn('⚠️ Container progression saison non trouvé');
            return;
        }

        try {
            console.log('📊 Chargement progression saison 2025...');

            // Récupérer toutes les courses de la saison 2025
            const seasonData = await fetchF1Data(
                `${F1DASHBOARD_CONFIG.BASE_URL}/2025`, 
                'season_2025_all_races'
            );

            console.log('📊 Données saison reçues:', seasonData);

            // Vérifier la structure de réponse
            if (!seasonData || !seasonData.races || !Array.isArray(seasonData.races)) {
                throw new Error(`Format invalide - races manquant. Reçu: ${JSON.stringify(Object.keys(seasonData || {}))}`);
            }

            const races = seasonData.races;
            this.totalRaces = races.length;

            console.log(`📊 Total courses trouvées: ${this.totalRaces}`);

            // Compter les courses terminées (date passée)
            const now = new Date();
            this.completedRaces = 0;

            races.forEach((race, index) => {
                if (race.schedule && race.schedule.race && race.schedule.race.date) {
                    const raceDate = new Date(race.schedule.race.date + 'T23:59:59Z'); // Fin de journée
                    const isCompleted = raceDate < now;

                    console.log(`🏁 Course ${index + 1}: ${race.circuit?.country || 'Unknown'} - ${race.schedule.race.date} - ${isCompleted ? 'TERMINÉE' : 'À VENIR'}`);

                    if (isCompleted) {
                        this.completedRaces++;
                    }
                } else {
                    console.warn(`⚠️ Course ${index + 1}: pas de date trouvée`);
                }
            });

            console.log(`🏁 Résultat: ${this.completedRaces}/${this.totalRaces} courses terminées`);
            this.render();

        } catch (error) {
            console.error('❌ Erreur progression saison:', error);
            this.renderError(error.message);
        }
    }

    render() {
        if (!this.container) return;

        const percentage = this.totalRaces > 0 ? 
            Math.round((this.completedRaces / this.totalRaces) * 100) : 0;

        // Générer les segments de progression (24 segments par défaut)
        const totalSegments = Math.max(this.totalRaces || 0, 24); // Au minimum 24 segments
        const activeSegments = this.completedRaces;


        console.log(`🏁 Debug: ${this.completedRaces} courses terminées sur ${this.totalRaces} total = ${percentage}%`);
        console.log(`📊 Segments: ${activeSegments} actifs sur ${totalSegments} total`);

        let segmentsHTML = '';
        for (let i = 0; i < totalSegments; i++) {
            const isActive = i < activeSegments ? 'active' : '';
            if (isActive) {
                    console.log(`✅ Segment ${i} actif`);
                }
                segmentsHTML += `<div class="bar-segment ${isActive}"></div>`;
            }

        // Utiliser le design du widget original
        this.container.querySelector('.card-content').innerHTML = `
            <div class="progress-widget-content">
                <div class="progress-header">
                    <div class="percentage">${percentage}%</div>
                    <div class="counter-section">
                        <div class="fraction">
                            ${this.completedRaces}<span style="opacity: 0.7;">/</span><span class="denominator">${this.totalRaces}</span>
                        </div>
                        <div class="label">GP Complété</div>
                    </div>
                </div>

                <div class="progress-bar">
                    ${segmentsHTML}
                </div>
            </div>
        `;
    }

    renderError(message) {
        if (!this.container) return;

        this.container.querySelector('.card-content').innerHTML = `
            <div class="error-state">
                ❌ Erreur: ${message}
            </div>
        `;
    }
}

// === GESTIONNAIRE KILOMÉTRAGE (INCHANGÉ) ===
class KilometersManager {
    constructor() {
        this.currentKm = 0;
        this.totalKm = 0;
        this.container = document.getElementById('kilometersCard');
    }

    async loadKilometersData() {
        if (!this.container) {
            console.warn('⚠️ Container kilométrage non trouvé');
            return;
        }

        try {
            console.log('🏎️ Calcul du kilométrage...');

            // Réutiliser les données de progression (même endpoint)
            const seasonData = await fetchF1Data(
                `${F1DASHBOARD_CONFIG.BASE_URL}/2025`, 
                'season_2025_all_races'
            );

            if (!seasonData || !seasonData.races || !Array.isArray(seasonData.races)) {
                throw new Error(`Format invalide - races manquant`);
            }

            const races = seasonData.races;
            const now = new Date();
            this.currentKm = 0;
            this.totalKm = 0;

            races.forEach((race, index) => {
                // Extraire la distance du circuit
                const circuitDistance = this.parseCircuitLength(race.circuit?.circuitLength);
                const laps = race.laps || 60; // Utiliser laps de l'API ou défaut 60
                const raceKm = circuitDistance * laps;

                this.totalKm += raceKm;

                console.log(`🏎️ Course ${index + 1}: ${race.circuit?.circuitName || 'Unknown'} - ${circuitDistance}km x ${laps} tours = ${Math.round(raceKm)}km`);

                // Si la course est terminée, ajouter au kilométrage actuel
                if (race.schedule && race.schedule.race && race.schedule.race.date) {
                    const raceDate = new Date(race.schedule.race.date + 'T23:59:59Z');
                    if (raceDate < now) {
                        this.currentKm += raceKm;
                    }
                }
            });

            console.log(`🏎️ Kilométrage total: ${Math.round(this.currentKm)} / ${Math.round(this.totalKm)} km`);
            this.render();

        } catch (error) {
            console.error('❌ Erreur kilométrage:', error);
            this.renderError(error.message);
        }
    }

    parseCircuitLength(circuitLength) {
        if (!circuitLength) return 5.2; // Distance moyenne par défaut

        // Enlever "km" et convertir en nombre
        const length = parseFloat(circuitLength.replace(/[^\d.]/g, ''));

        if (isNaN(length)) return 5.2;

        // Si la valeur est en mètres (>1000), convertir en km
        return length > 100 ? length / 1000 : length;
    }

    render() {
        if (!this.container) return;

        const percentage = this.totalKm > 0 ? 
            Math.round((this.currentKm / this.totalKm) * 100) : 0;

        this.container.querySelector('.card-content').innerHTML = `
            <div class="kilometers-display">
                <span class="km-current">${Math.round(this.currentKm).toLocaleString()}</span>
                <span class="km-separator">/</span>
                <span class="km-total">${Math.round(this.totalKm).toLocaleString()}</span>
                <span class="km-unit">km</span>
            </div>
            <div class="kilometers-bar">
                <div class="kilometers-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="km-percentage">${percentage}% du kilométrage total parcouru</div>
        `;
    }

    renderError(message) {
        if (!this.container) return;

        this.container.querySelector('.card-content').innerHTML = `
            <div class="error-state">
                ❌ Erreur: ${message}
            </div>
        `;
    }
}

class NextEventManager {
    constructor() {
        this.nextEvent = null;
        this.container = document.getElementById('nextEventCard');
        this.countdownInterval = null;
        console.log('✅ NextEventManager créé avec countdown adaptatif');
    }

    async loadNextEvent() {
        if (!this.container) {
            console.warn('⚠️ Container prochain événement non trouvé');
            return;
        }

        try {
            console.log('⏰ Recherche du prochain événement...');

            const nextEventData = await this.fetchF1Data(
                'https://f1api.dev/api/current/next', 
                'next_race'
            );

            console.log('⏰ Données prochain événement:', nextEventData);

            if (!nextEventData || !nextEventData.race || !Array.isArray(nextEventData.race) || nextEventData.race.length === 0) {
                throw new Error(`Format invalide - race manquant. Reçu: ${JSON.stringify(Object.keys(nextEventData || {}))}`);
            }

            this.nextEvent = nextEventData.race[0];

            console.log(`⏰ Prochain événement trouvé: ${this.nextEvent.circuit?.country || 'Unknown'} GP le ${this.nextEvent.schedule?.race?.date}`);

            this.render();
            this.startCountdown();

        } catch (error) {
            console.error('❌ Erreur prochain événement:', error);
            this.renderError(error.message);
        }
    }

    async fetchF1Data(url, cacheKey) {
        try {
            console.log(`🔄 Requête F1API: ${url}`);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ Données F1 reçues: ${cacheKey}`);
            return data;
        } catch (error) {
            console.error(`❌ Erreur API F1 ${url}:`, error);
            throw error;
        }
    }

    updateCountdown() {
        if (!this.nextEvent || !this.container) return;

        const schedule = this.nextEvent.schedule;
        if (!schedule || !schedule.race || !schedule.race.date) {
            console.warn('⚠️ Pas de date de course trouvée');
            return;
        }

        const now = new Date();
        let eventDate = new Date(schedule.race.date);

        // Ajouter l'heure si elle existe, sinon supposer 14h00 UTC
        if (schedule.race.time) {
            const timeStr = schedule.race.time.replace('Z', '');
            eventDate = new Date(`${schedule.race.date}T${timeStr}`);
        } else {
            eventDate = new Date(`${schedule.race.date}T14:00:00Z`);
        }

        const timeDiff = eventDate - now;

        if (timeDiff <= 0) {
            console.log('🔄 Événement commencé, rechargement...');
            this.loadNextEvent();
            return;
        }

        // ===== CALCUL COMPLET DU TEMPS RESTANT =====
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        // ===== AFFICHAGE ADAPTATIF SELON LE TEMPS RESTANT =====
        let timeDisplay = '';

        if (days > 0) {
            // Plus de 24h : jours + heures + minutes + secondes
            timeDisplay = `${days}j ${hours}h ${minutes}m ${seconds}s`;
        } else if (hours > 0) {
            // Moins de 24h mais plus d'1h : heures + minutes + secondes
            timeDisplay = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            // Moins d'1h mais plus d'1min : minutes + secondes
            timeDisplay = `${minutes}m ${seconds}s`;
        } else {
            // Moins d'1min : seulement secondes
            timeDisplay = `${seconds}s`;
        }

        // Mettre à jour l'affichage
        const timeElement = this.container.querySelector('.time');

        if (timeElement) {
            timeElement.textContent = timeDisplay;

            // ===== EFFETS VISUELS SELON L'URGENCE =====
            if (days === 0 && hours === 0 && minutes < 5) {
                timeElement.style.animation = 'timePulse 1s ease-in-out infinite';
                timeElement.style.color = '#ff4444'; // Rouge urgent
            } else if (days === 0 && hours === 0 && minutes < 60) {
                timeElement.style.color = '#ff8800'; // Orange pour dernière heure
                timeElement.style.animation = '';
            } else {
                timeElement.style.animation = '';
                timeElement.style.color = '#9945FF'; // Couleur normale
            }
        }

        console.log(`⏰ Countdown: ${timeDisplay}`);
    }

    render() {
        if (!this.container || !this.nextEvent) return;

        const schedule = this.nextEvent.schedule;
        if (!schedule || !schedule.race || !schedule.race.date) {
            this.renderError('Pas de date trouvée');
            return;
        }

        let eventDate = new Date(schedule.race.date);
        if (schedule.race.time) {
            const timeStr = schedule.race.time.replace('Z', '');
            eventDate = new Date(`${schedule.race.date}T${timeStr}`);
        } else {
            eventDate = new Date(`${schedule.race.date}T14:00:00Z`);
        }

        const day = eventDate.getDate();
        const month = eventDate.toLocaleDateString('fr-FR', { month: 'long' });
        const year = eventDate.getFullYear();

        const eventName = this.nextEvent.raceName || 
                         `GP ${this.nextEvent.circuit?.country || 'F1'}`;

        // ===== DESIGN SIMPLE SANS BARRE DE PROGRESSION =====
        this.container.querySelector('.card-content').innerHTML = `
            <div class="practice-widget-content">
                <div class="header">${eventName}</div>

                <div class="date-section">
                    <div class="date-text">${day} ${month} ${year}</div>
                </div>

                <div style="display: flex; align-items: baseline; justify-content: center; gap: 6px;">
                    <div class="time" style="transition: color 0.3s ease; font-weight: 600;">Calcul...</div>
                    <div class="pm" style="font-size: 12px; opacity: 0.8;">restant</div>
                </div>
            </div>
        `;

        // Ajouter le style CSS pour l'animation de pulsation si pas encore présent
        if (!document.getElementById('countdown-animation-styles')) {
            const style = document.createElement('style');
            style.id = 'countdown-animation-styles';
            style.textContent = `
                @keyframes timePulse {
                    0%, 100% { 
                        transform: scale(1); 
                        text-shadow: 0 0 8px rgba(255, 68, 68, 0.4);
                    }
                    50% { 
                        transform: scale(1.03); 
                        text-shadow: 0 0 15px rgba(255, 68, 68, 0.7);
                    }
                }

                .practice-widget-content .time {
                    font-weight: 600 !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    startCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        // Mise à jour chaque seconde
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);

        // Première mise à jour immédiate
        this.updateCountdown();
    }

    renderError(message) {
        if (!this.container) return;

        this.container.querySelector('.card-content').innerHTML = `
            <div class="error-state" style="
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                height: 100%; 
                text-align: center;
                color: #ff4444;
                font-size: 14px;
            ">
                <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                <div>Erreur: ${message}</div>
                <button onclick="if(window.refreshF1Dashboard) window.refreshF1Dashboard()" style="
                    margin-top: 10px;
                    padding: 6px 12px;
                    background: rgba(153, 69, 255, 0.1);
                    border: 1px solid rgba(153, 69, 255, 0.3);
                    border-radius: 6px;
                    color: #9945FF;
                    cursor: pointer;
                    font-size: 12px;
                ">
                    🔄 Réessayer
                </button>
            </div>
        `;
    }

    destroy() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        const styles = document.getElementById('countdown-animation-styles');
        if (styles) {
            styles.remove();
        }
    }
}

// === GESTIONNAIRE PRINCIPAL DASHBOARD (INCHANGÉ) ===
class F1DashboardManager {
    constructor() {
        this.seasonProgress = new SeasonProgressManager();
        this.kilometers = new KilometersManager();
        this.nextEvent = new NextEventManager();
        this.refreshInterval = null;
    }

    async init() {
        console.log('🏁 Initialisation Dashboard F1...');

        try {
            // Charger toutes les données en parallèle
            const loadPromises = [
                this.seasonProgress.loadSeasonData().catch(err => 
                    console.error('Erreur progression saison:', err)
                ),
                this.kilometers.loadKilometersData().catch(err => 
                    console.error('Erreur kilométrage:', err)
                ),
                this.nextEvent.loadNextEvent().catch(err => 
                    console.error('Erreur prochain événement:', err)
                )
            ];

            await Promise.allSettled(loadPromises);

            // Programmer les actualisations automatiques
            this.startAutoRefresh();

            console.log('✅ Dashboard F1 initialisé avec succès');
        } catch (error) {
            console.error('❌ Erreur initialisation dashboard:', error);
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            console.log('🔄 Actualisation automatique du dashboard...');
            this.refresh();
        }, F1DASHBOARD_CONFIG.REFRESH_INTERVAL);
    }

    async refresh() {
        console.log('🔄 Actualisation du Dashboard F1...');

        try {
            // Vider le cache pour forcer le rechargement
            dashboardCache.clear();

            // Recharger toutes les données
            await this.init();
        } catch (error) {
            console.error('❌ Erreur actualisation dashboard:', error);
        }
    }

    destroy() {
        console.log('🧹 Nettoyage Dashboard F1...');

        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        this.nextEvent.destroy();
        dashboardCache.clear();
    }
}

// === INSTANCE GLOBALE ===
let f1DashboardManager = null;

// === INITIALISATION ===
function initF1Dashboard() {
    const progressCard = document.getElementById('seasonProgressCard');
    const kmCard = document.getElementById('kilometersCard');
    const eventCard = document.getElementById('nextEventCard');

    if (!progressCard || !kmCard || !eventCard) {
        console.log('⏳ Éléments dashboard pas encore chargés, nouvelle tentative...');
        setTimeout(initF1Dashboard, 1000);
        return;
    }

    console.log('🎯 Tous les éléments dashboard trouvés, initialisation...');

    if (f1DashboardManager) {
        f1DashboardManager.destroy();
    }

    f1DashboardManager = new F1DashboardManager();
    f1DashboardManager.init();
}

// === INTÉGRATION AVEC LE SYSTÈME EXISTANT ===

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM chargé, initialisation dashboard dans 2 secondes...');
    setTimeout(initF1Dashboard, 0000);
});

// Intégration avec showTab
const originalShowTab = window.showTab;
if (typeof originalShowTab === 'function') {
    window.showTab = function(tabName) {
        originalShowTab(tabName);

        if (tabName === 'news') {
            setTimeout(() => {
                if (!f1DashboardManager) {
                    console.log('🎯 Onglet news ouvert, initialisation dashboard...');
                    initF1Dashboard();
                }
            }, 500);
        }
    };
} else {
    // Si showTab n'existe pas encore, l'ajouter
    window.showTab = function(tabName) {
        // Code de base pour showTab
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.classList.add('active');
        }

        // Initialiser dashboard si onglet news
        if (tabName === 'news') {
            setTimeout(() => {
                if (!f1DashboardManager) {
                    initF1Dashboard();
                }
            }, 500);
        }
    };
}

// Nettoyage avant fermeture
window.addEventListener('beforeunload', () => {
    if (f1DashboardManager) {
        f1DashboardManager.destroy();
    }
});

// === FONCTIONS UTILITAIRES GLOBALES ===
window.refreshF1Dashboard = function() {
    console.log('🔄 Actualisation manuelle du dashboard...');
    if (f1DashboardManager) {
        f1DashboardManager.refresh();
    } else {
        initF1Dashboard();
    }
};

window.f1DashboardDebug = {
    manager: () => f1DashboardManager,
    cache: () => Array.from(dashboardCache.entries()),
    clearCache: () => {
        dashboardCache.clear();
        console.log('🗑️ Cache vidé');
    },
    refresh: () => window.refreshF1Dashboard(),
    config: F1DASHBOARD_CONFIG,
    testAPI: async () => {
        try {
            const test2025 = await fetch(`${F1DASHBOARD_CONFIG.BASE_URL}/2025`);
            const testNext = await fetch(`${F1DASHBOARD_CONFIG.BASE_URL}/current/next`);

            console.log('🧪 Test API /2025:', test2025.status, test2025.ok);
            console.log('🧪 Test API /current/next:', testNext.status, testNext.ok);

            if (test2025.ok) {
                const data2025 = await test2025.json();
                console.log('📊 Données 2025:', data2025);
            }

            if (testNext.ok) {
                const dataNext = await testNext.json();
                console.log('⏰ Données next:', dataNext);
            }
        } catch (error) {
            console.error('🧪 Erreur test API:', error);
        }
    }
};

// Rafraîchir quand la page redevient visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && f1DashboardManager) {
        const cacheEntries = Array.from(dashboardCache.values());
        if (cacheEntries.length > 0) {
            const lastUpdate = Math.min(...cacheEntries.map(item => item.timestamp));

            if (Date.now() - lastUpdate > F1DASHBOARD_CONFIG.CACHE_DURATION) {
                console.log('🔄 Page redevenue visible, actualisation du dashboard...');
                f1DashboardManager.refresh();
            }
        }
    }
});

// ===== SYSTÈME DE NOTIFICATIONS RSS - RACE TO WIN =====

class RSSNotificationManager {
    constructor() {
        this.lastCheck = localStorage.getItem('rssLastCheck') || null;
        this.knownArticles = new Set(JSON.parse(localStorage.getItem('rssKnownArticles') || '[]'));
        this.notificationPermission = false;
        this.checkInterval = null;
        this.rssUrl = 'https://fr.motorsport.com/rss/f1/news/';
        this.checkFrequency = 5 * 60 * 1000; // 5 minutes
        this.notificationsEnabled = localStorage.getItem('rssNotificationsEnabled') === 'true';

        this.init();
    }

    async init() {
        console.log('🔔 Initialisation du système de notifications RSS...');

        // Demander la permission pour les notifications
        await this.requestNotificationPermission();

        // Charger les articles connus au démarrage
        await this.loadInitialArticles();

        // Démarrer la vérification périodique après un délai
        if (this.notificationsEnabled) {
            setTimeout(() => {
                this.startPeriodicCheck();
            }, 30000); // Attendre 30 secondes avant de démarrer la vérification périodique
        }

        // Créer l'interface de contrôle
        this.createNotificationToggle();

        console.log('✅ Système de notifications RSS initialisé');
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('⚠️ Ce navigateur ne supporte pas les notifications');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission === 'granted';

            if (this.notificationPermission) {
                console.log('✅ Permission de notification accordée');

                // Vérifier si la notification de bienvenue a déjà été montrée
                const welcomeShown = localStorage.getItem('welcomeNotificationShown');
                if (!welcomeShown) {
                    this.showWelcomeNotification();
                    localStorage.setItem('welcomeNotificationShown', 'true');
                }
            } else {
                console.log('❌ Permission de notification refusée');
            }

            return this.notificationPermission;
        } catch (error) {
            console.error('❌ Erreur demande permission:', error);
            return false;
        }
    }

    showWelcomeNotification() {
        if (!this.notificationPermission) return;

        const notification = new Notification('🏎️ Race to Win', {
            body: 'Notifications F1 activées ! Vous recevrez les dernières actualités en temps réel.',
            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTYiIGZpbGw9IiM5OTQ1RkYiLz4KPHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+PjjwvdGV4dD4KPC9zdmc+',
            badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiNGRjAwMDAiLz4KPHRleHQgeD0iMTIiIHk9IjE2IiBmb250LXNpemU9IjEwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RjE8L3RleHQ+Cjwvc3ZnPg==',
            tag: 'rss-welcome',
            requireInteraction: false
        });

        // Auto-fermer après 4 secondes
        setTimeout(() => {
            notification.close();
        }, 4000);
    }

    async loadInitialArticles() {
        try {
            console.log('📰 Chargement des articles existants...');
            const articles = await this.fetchRSSFeed();

            if (articles && articles.length > 0) {
                // Marquer tous les articles actuels comme connus
                articles.forEach(article => {
                    const articleId = this.generateArticleId(article);
                    this.knownArticles.add(articleId);
                });

                this.saveKnownArticles();
                this.lastCheck = new Date().toISOString();
                localStorage.setItem('rssLastCheck', this.lastCheck);

                console.log(`📚 ${articles.length} articles existants chargés`);
            }
        } catch (error) {
            console.error('❌ Erreur chargement articles initiaux:', error);
        }
    }

    async fetchRSSFeed() {
        try {
            const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(this.rssUrl)}`);
            const data = await response.json();

            if (data.status === 'ok') {
                return data.items;
            } else {
                throw new Error('Erreur API RSS: ' + data.message);
            }
        } catch (error) {
            console.error('❌ Erreur récupération RSS:', error);
            return null;
        }
    }

    generateArticleId(article) {
        // Créer un ID unique basé sur le titre et la date
        return btoa(encodeURIComponent(article.title + article.pubDate)).substring(0, 20);
    }

    async checkForNewArticles() {
        if (!this.notificationsEnabled || !this.notificationPermission) {
            return;
        }

        try {
            console.log('🔍 Vérification de nouveaux articles...');
            const articles = await this.fetchRSSFeed();

            if (!articles || articles.length === 0) {
                console.log('⚠️ Aucun article récupéré');
                return;
            }

            const newArticles = [];

            articles.forEach(article => {
                const articleId = this.generateArticleId(article);

                if (!this.knownArticles.has(articleId)) {
                    // Vérifier que l'article est récent (dernières 2 heures)
                    const articleDate = new Date(article.pubDate);
                    const now = new Date();
                    const hoursDiff = (now - articleDate) / (1000 * 60 * 60);

                    if (hoursDiff <= 2) {
                        newArticles.push(article);
                        this.knownArticles.add(articleId);
                    }
                }
            });

            if (newArticles.length > 0) {
                console.log(`🆕 ${newArticles.length} nouveaux articles trouvés`);
                this.showNewArticleNotifications(newArticles);
                this.saveKnownArticles();
            } else {
                console.log('✅ Aucun nouvel article');
            }

            this.lastCheck = new Date().toISOString();
            localStorage.setItem('rssLastCheck', this.lastCheck);

        } catch (error) {
            console.error('❌ Erreur vérification articles:', error);
        }
    }

    showNewArticleNotifications(articles) {
        if (!this.notificationPermission) return;

        articles.forEach((article, index) => {
            // Délai entre les notifications pour éviter le spam
            setTimeout(() => {
                this.showArticleNotification(article);
            }, index * 1000);
        });

        // Mettre à jour le badge avec le nombre de nouveaux articles
        this.updateNotificationBadge(articles.length);
    }

    showArticleNotification(article) {
        if (!this.notificationPermission) return;

        try {
            // Nettoyer le titre et la description
            const title = this.cleanText(article.title);
            const description = this.cleanText(article.description || '').substring(0, 120) + '...';

            // Extraire l'image si disponible
            let icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTYiIGZpbGw9IiNGRjAwMDAiLz4KPHRleHQgeD0iMzIiIHk9IjQwIiBmb250LXNpemU9IjI0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RjE8L3RleHQ+Cjwvc3ZnPg==';

            if (article.enclosure && article.enclosure.link) {
                icon = article.enclosure.link;
            }

            const notification = new Notification(`🏎️ ${title}`, {
                body: description,
                icon: icon,
                badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiNGRjAwMDAiLz4KPHRleHQgeD0iMTIiIHk9IjE2IiBmb250LXNpemU9IjEwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RjE8L3RleHQ+Cjwvc3ZnPg==',
                tag: `rss-article-${this.generateArticleId(article)}`,
                requireInteraction: false,
                silent: false,
                timestamp: new Date(article.pubDate).getTime(),
                data: {
                    url: article.link,
                    title: title,
                    content: description
                }
            });

            // Gestion du clic sur la notification
            notification.onclick = (event) => {
                event.preventDefault();

                // Fermer la notification
                notification.close();

                // Focus sur la fenêtre de l'app
                if (window.focus) {
                    window.focus();
                }

                // Ouvrir l'article (vous pouvez personnaliser cette partie)
                this.openArticle(article);

                // Analytics
                console.log('📊 Notification cliquée:', article.title);
            };

            // Auto-fermer après 8 secondes
            setTimeout(() => {
                notification.close();
            }, 8000);

            console.log('🔔 Notification envoyée:', title);

        } catch (error) {
            console.error('❌ Erreur affichage notification:', error);
        }
    }

    openArticle(article) {
        // Basculer vers l'onglet actualités
        if (window.showTab) {
            window.showTab('news');
        }

        // Optionnel: ouvrir l'article dans un lecteur interne
        if (window.openArticle) {
            window.openArticle(article.title, article.content);
        } else {
            // Fallback: ouvrir dans un nouvel onglet
            window.open(article.link, '_blank');
        }
    }

    cleanText(text) {
        // Nettoyer le HTML et les caractères spéciaux
        return text
            .replace(/<[^>]*>/g, '') // Supprimer les balises HTML
            .replace(/&[^;]+;/g, ' ') // Supprimer les entités HTML
            .replace(/\s+/g, ' ') // Normaliser les espaces
            .trim();
    }

    updateNotificationBadge(count) {
        // Mettre à jour le badge de l'app (si supporté)
        if ('setAppBadge' in navigator) {
            navigator.setAppBadge(count).catch(err => {
                console.log('Badge non supporté:', err);
            });
        }

        // Mettre à jour le titre de la page
        if (count > 0) {
            document.title = `(${count}) Race to Win - Nouveaux articles F1`;

            // Remettre le titre normal après 10 secondes
            setTimeout(() => {
                document.title = 'Race to Win';
            }, 10000);
        }
    }

    startPeriodicCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        console.log(`⏰ Démarrage vérification périodique (${this.checkFrequency / 60000}min)`);

        // Première vérification après 30 secondes
        setTimeout(() => {
            this.checkForNewArticles();
        }, 30000);

        // Puis vérification périodique
        this.checkInterval = setInterval(() => {
            this.checkForNewArticles();
        }, this.checkFrequency);
    }

    stopPeriodicCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('⏹️ Vérification périodique arrêtée');
        }
    }

    enableNotifications() {
        this.notificationsEnabled = true;
        localStorage.setItem('rssNotificationsEnabled', 'true');

        if (this.notificationPermission) {
            this.startPeriodicCheck();
            this.showNotificationStatus('✅ Notifications activées');
        } else {
            this.requestNotificationPermission().then(granted => {
                if (granted) {
                    this.startPeriodicCheck();
                    this.showNotificationStatus('✅ Notifications activées');
                } else {
                    this.showNotificationStatus('❌ Permission refusée');
                }
            });
        }
    }

    disableNotifications() {
        this.notificationsEnabled = false;
        localStorage.setItem('rssNotificationsEnabled', 'false');
        this.stopPeriodicCheck();
        this.showNotificationStatus('🔕 Notifications désactivées');
    }

    showNotificationStatus(message) {
        // Afficher un toast/message temporaire
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #9945FF, #14F195);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        document.body.appendChild(toast);

        // Animation d'entrée
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Auto-suppression
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    createNotificationToggle() {
        // Ajouter un bouton de contrôle dans le menu profil
        const profileMenu = document.querySelector('.profile-menu');
        if (profileMenu) {
            const notificationItem = document.createElement('li');
            notificationItem.innerHTML = `
                <button onclick="window.rssNotificationManager.toggleNotifications()" id="notificationToggleBtn">
                    ${this.notificationsEnabled ? '🔔' : '🔕'} Notifications RSS
                </button>
            `;

            // Insérer avant le bouton de déconnexion
            const logoutItem = profileMenu.querySelector('.logout-btn').parentElement;
            profileMenu.insertBefore(notificationItem, logoutItem);
        }

        // Ajouter aussi dans les préférences de la page profil
        const preferencesCard = document.querySelector('.profile-preferences-card');
        if (preferencesCard) {
            const notificationPref = document.createElement('div');
            notificationPref.className = 'profile-preference-item';
            notificationPref.innerHTML = `
                <span class="profile-preference-label">Notifications articles F1</span>
                <div class="profile-preference-toggle ${this.notificationsEnabled ? 'active' : ''}" 
                     onclick="window.rssNotificationManager.toggleNotifications()">
                </div>
            `;
            preferencesCard.appendChild(notificationPref);
        }
    }

    toggleNotifications() {
        if (this.notificationsEnabled) {
            this.disableNotifications();
        } else {
            this.enableNotifications();
        }

        // Mettre à jour l'interface
        this.updateNotificationUI();
    }

    updateNotificationUI() {
        // Mettre à jour le bouton dans le menu
        const toggleBtn = document.getElementById('notificationToggleBtn');
        if (toggleBtn) {
            toggleBtn.innerHTML = `${this.notificationsEnabled ? '🔔' : '🔕'} Notifications RSS`;
        }

        // Mettre à jour le toggle dans les préférences
        const prefToggle = document.querySelector('.profile-preference-item .profile-preference-toggle');
        if (prefToggle) {
            if (this.notificationsEnabled) {
                prefToggle.classList.add('active');
            } else {
                prefToggle.classList.remove('active');
            }
        }
    }

    saveKnownArticles() {
        const articlesArray = Array.from(this.knownArticles);
        // Garder seulement les 100 derniers articles pour éviter une liste trop longue
        const limitedArticles = articlesArray.slice(-100);
        localStorage.setItem('rssKnownArticles', JSON.stringify(limitedArticles));
        this.knownArticles = new Set(limitedArticles);
    }

    // Méthode pour forcer une vérification manuelle
    async forceCheck() {
        console.log('🔄 Vérification manuelle forcée...');
        await this.checkForNewArticles();
        this.showNotificationStatus('🔍 Vérification effectuée');
    }

    // Méthode pour afficher les statistiques
    getStats() {
        const stats = {
            notificationsEnabled: this.notificationsEnabled,
            permissionGranted: this.notificationPermission,
            lastCheck: this.lastCheck,
            knownArticlesCount: this.knownArticles.size,
            checkFrequency: this.checkFrequency / 60000 + ' minutes'
        };

        console.table(stats);
        return stats;
    }

    // Nettoyage lors de la fermeture
    cleanup() {
        this.stopPeriodicCheck();
        this.saveKnownArticles();
        console.log('🧹 Système de notifications RSS nettoyé');
    }
}

// ===== INITIALISATION ET INTÉGRATION =====

// Variable globale pour le gestionnaire
let rssNotificationManager = null;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    // Attendre un peu que l'app soit initialisée
    setTimeout(() => {
        rssNotificationManager = new RSSNotificationManager();

        // Exposer globalement pour les contrôles
        window.rssNotificationManager = rssNotificationManager;

        console.log('🔔 Gestionnaire de notifications RSS initialisé');
    }, 2000);
});

// Nettoyage avant fermeture de page
window.addEventListener('beforeunload', function() {
    if (rssNotificationManager) {
        rssNotificationManager.cleanup();
    }
});

// Gestion de la visibilité de la page (économie de batterie)
document.addEventListener('visibilitychange', function() {
    if (rssNotificationManager) {
        if (document.hidden) {
            // Page cachée - ralentir les vérifications
            console.log('📱 Page cachée - ralentissement des vérifications');
        } else {
            // Page visible - vérification immédiate
            console.log('👁️ Page visible - vérification immédiate');
            setTimeout(() => {
                rssNotificationManager.checkForNewArticles();
            }, 1000);
        }
    }
});

// ===== FONCTIONS UTILITAIRES POUR LES DÉVELOPPEURS =====

window.rssNotificationDebug = {
    // Forcer une vérification
    check: () => {
        if (rssNotificationManager) {
            rssNotificationManager.forceCheck();
        }
    },

    // Voir les statistiques
    stats: () => {
        if (rssNotificationManager) {
            return rssNotificationManager.getStats();
        }
    },

    // Activer/désactiver
    toggle: () => {
        if (rssNotificationManager) {
            rssNotificationManager.toggleNotifications();
        }
    },

    // Effacer le cache des articles connus
    clearCache: () => {
        localStorage.removeItem('rssKnownArticles');
        localStorage.removeItem('rssLastCheck');
        console.log('🗑️ Cache RSS effacé');
    },

    // Simuler un nouvel article (pour test)
    simulateNew: () => {
        if (rssNotificationManager && rssNotificationManager.notificationPermission) {
            const fakeArticle = {
                title: 'TEST: Verstappen remporte le GP de Monza !',
                description: 'Une course incroyable avec un finish serré entre les trois premiers pilotes...',
                pubDate: new Date().toISOString(),
                link: 'https://example.com/test-article',
                enclosure: null
            };
        }
    }
};

// Pour la page d'authentification
function showAuthOverlay() {
    document.getElementById('authOverlay').style.display = 'flex';
    document.body.classList.add('auth-active');
}

function hideAuthOverlay() {
    document.getElementById('authOverlay').style.display = 'none';
    document.body.classList.remove('auth-active');
}

// Fonction pour charger le prochain circuit (version corrigée avec proxy)
async function loadNextCircuit() {
    const container = document.getElementById('circuitContent');

    // Afficher le loading
    container.innerHTML = `
        <div class="circuit-loading">
            <div class="circuit-loading-spinner"></div>
            Chargement...
        </div>
    `;

    try {
        console.log('🏁 Chargement du prochain circuit...');

        // Utiliser un proxy CORS comme pour le RSS
        const apiUrl = 'https://f1connectapi.vercel.app/api/current/next';
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;

        console.log('🌐 URL avec proxy:', proxyUrl);

        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const proxyData = await response.json();
        console.log('📊 Réponse proxy reçue:', proxyData);

        // Le contenu est dans proxyData.contents
        const data = JSON.parse(proxyData.contents);
        console.log('🏁 Données circuit parsées:', data);

        if (data.race && data.race[0]) {
            const race = data.race[0];
            const circuit = race.circuit;

            // Extraire les données avec fallbacks
            const circuitName = circuit?.circuitName || 'Circuit inconnu';
            const city = circuit?.city || 'Ville';
            const country = circuit?.country || 'Pays';
            const raceDate = race?.schedule?.race?.date;
            const round = race?.round || '?';
            const circuitLength = circuit?.circuitLength || '?';
            const corners = circuit?.corners || '?';
            const lapRecord = circuit?.lapRecord || 'N/A';

            // Formatter la date
            let formattedDate = 'Date à confirmer';
            if (raceDate) {
                try {
                    const date = new Date(raceDate);
                    formattedDate = date.toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long'
                    });
                } catch (e) {
                    formattedDate = raceDate;
                }
            }

            // Afficher le contenu
            container.innerHTML = `
                <div class="circuit-name">${circuitName}</div>

                <div class="circuit-location">
                    <span class="location-icon">📍</span>
                    <span>${city}, ${country}</span>
                </div>

                <div class="circuit-stats">
                    <div class="circuit-stat">
                        <span class="stat-value">${formattedDate}</span>
                        <span class="stat-unit">date</span>
                    </div>
                    <div class="circuit-stat">
                        <span class="stat-value">R${round}</span>
                        <span class="stat-unit">manche</span>
                    </div>
                </div>

                <div class="circuit-record">
                    <div class="record-time">${circuitLength} • ${corners} virages</div>
                    <div class="record-holder">Record : ${lapRecord}</div>
                </div>
            `;

            console.log('✅ Widget circuit mis à jour avec succès');

        } else {
            console.log('⚠️ Aucune donnée de course trouvée');
            container.innerHTML = `
                <div style="text-align: center; color: #8b949e; font-size: 12px; padding: 20px;">
                    Aucune course à venir
                </div>
            `;
        }
    } catch (error) {
        console.error('❌ Erreur chargement circuit:', error);

        // Fallback: essayer avec une API alternative
        try {
            console.log('🔄 Tentative avec API alternative...');
            await loadCircuitFallback(container);
        } catch (fallbackError) {
            console.error('❌ Erreur API alternative:', fallbackError);

            container.innerHTML = `
                <div style="text-align: center; color: #f85149; font-size: 12px; padding: 20px;">
                    Erreur de connexion
                    <br>
                    <button onclick="loadNextCircuit()" style="
                        margin-top: 8px;
                        padding: 4px 8px;
                        background: rgba(153, 69, 255, 0.1);
                        border: 1px solid rgba(153, 69, 255, 0.3);
                        border-radius: 4px;
                        color: #9945FF;
                        cursor: pointer;
                        font-size: 11px;
                    ">
                        🔄 Réessayer
                    </button>
                </div>
            `;
        }
    }
}

// API de secours avec une autre source
async function loadCircuitFallback(container) {
    console.log('🔄 Utilisation de l\'API de secours...');

    // Essayer avec l'API Ergast (plus fiable)
    const currentYear = new Date().getFullYear();
    const response = await fetch(`https://ergast.com/api/f1/${currentYear}.json`);

    if (!response.ok) {
        throw new Error('API Ergast non disponible');
    }

    const data = await response.json();
    const races = data.MRData.RaceTable.Races;

    if (races && races.length > 0) {
        // Trouver la prochaine course
        const now = new Date();
        const nextRace = races.find(race => {
            const raceDate = new Date(race.date);
            return raceDate > now;
        });

        if (nextRace) {
            const circuit = nextRace.Circuit;
            const raceDate = new Date(nextRace.date);
            const formattedDate = raceDate.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long'
            });

            container.innerHTML = `
                <div class="circuit-name">${circuit.circuitName}</div>

                <div class="circuit-location">
                    <span class="location-icon">📍</span>
                    <span>${circuit.Location.locality}, ${circuit.Location.country}</span>
                </div>

                <div class="circuit-stats">
                    <div class="circuit-stat">
                        <span class="stat-value">${formattedDate}</span>
                        <span class="stat-unit">date</span>
                    </div>
                    <div class="circuit-stat">
                        <span class="stat-value">R${nextRace.round}</span>
                        <span class="stat-unit">manche</span>
                    </div>
                </div>

                <div class="circuit-record">
                    <div class="record-time">GP ${nextRace.raceName}</div>
                    <div class="record-holder">Source : Ergast API</div>
                </div>
            `;

            console.log('✅ Widget circuit mis à jour avec API de secours');
        } else {
            throw new Error('Aucune course à venir trouvée');
        }
    } else {
        throw new Error('Données de course manquantes');
    }
}

// Intégrer dans votre système existant (inchangé)
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadNextCircuit();
    }, 1000);

    setInterval(() => {
        if (document.visibilityState === 'visible') {
            console.log('🔄 Actualisation automatique du widget circuit...');
            loadNextCircuit();
        }
    }, 10 * 60 * 1000);
});

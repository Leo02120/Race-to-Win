// ===== SYSTÈME DE CHAT EN TEMPS RÉEL =====
class RealtimeChatManager {
    constructor(authSystem) {
        this.authSystem = authSystem;
        this.currentSalon = null;
        this.subscription = null;
        this.messagesContainer = null;
        this.messageInput = null;
        this.sendButton = null;
        this.recentMessages = new Set(); // Pour éviter les doublons
        this.isSending = false; // Protection contre les envois multiples

        this.initializeElements();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('discussionMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.querySelector('.discussion-input button, .send-button');

        // ⚠️ IMPORTANT: Ne pas ajouter d'event listeners ici !
        // Ils sont gérés dans le DOMContentLoaded pour éviter les doublons
        console.log('🔌 Éléments du chat initialisés sans event listeners');
    }

    // Rejoindre un salon spécifique
    async joinSalon(salonId) {
        console.log(`🚀 Rejoindre le salon: ${salonId}`);
        showSalonConnectionStatus(salonId, 'connecting');

        // Quitter l'ancien salon si on était connecté
        if (this.subscription) {
            console.log('🔌 Déconnexion de l\'ancien salon...');
            await window.supabaseClient.removeChannel(this.subscription);
        }

        this.currentSalon = salonId;

        // Charger les messages existants
        console.log('📂 Chargement des messages existants...');
        await this.loadMessages(salonId);

        // S'abonner aux nouveaux messages en temps réel
        console.log('🔔 Abonnement aux nouveaux messages...');
        this.subscription = window.supabaseClient
            .channel(`salon_${salonId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `salon_id=eq.${salonId}`
                },
                (payload) => {
                    console.log('📨 Nouveau message reçu via Realtime:', payload.new);
                    this.displayMessage(payload.new);
                    playNotificationSound();
                }
            )
            .subscribe();

        showSalonConnectionStatus(salonId, 'connected');
        displaySystemMessage(`Vous avez rejoint ${salonId === 'global' ? 'le chat global' : 'le salon ' + salonId}`);
        console.log(`✅ Connecté au salon ${salonId}`);
    }

    // Charger les messages existants du salon
    async loadMessages(salonId) {
        try {
            const { data: messages, error } = await window.supabaseClient
                .from('messages')
                .select('*')
                .eq('salon_id', salonId)
                .order('created_at', { ascending: true })
                .limit(50); // Limiter à 50 messages récents

            if (error) {
                console.error('Erreur lors du chargement des messages:', error);
                return;
            }

            // Vider le conteneur et réinitialiser la cache des messages
            if (this.messagesContainer) {
                this.messagesContainer.innerHTML = '';
                this.recentMessages.clear(); // Vider la cache

                messages.forEach(message => this.displayMessage(message));
                this.scrollToBottom();
            }

        } catch (error) {
            console.error('Erreur lors du chargement des messages:', error);
        }
    }

    // Afficher un message dans l'interface
    displayMessage(message) {
        if (!this.messagesContainer) return;

        // Créer une clé unique basée sur le contenu, l'utilisateur et le temps
        const messageKey = `${message.user_id}-${message.content}-${message.created_at}`;

        console.log('📋 Tentative d\'affichage du message:', messageKey);

        // Vérifier si ce message a déjà été affiché récemment
        if (this.recentMessages.has(messageKey)) {
            console.log('🚫 Message doublon détecté et ignoré:', messageKey);
            return;
        }

        console.log('✅ Nouveau message valide, affichage en cours...');

        // Ajouter à la liste des messages récents
        this.recentMessages.add(messageKey);

        // Nettoyer les anciens messages de la cache après 10 secondes
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

        // Obtenir l'initiale de l'utilisateur
        const userInitial = message.user_name ? message.user_name.charAt(0).toUpperCase() : 'U';

        // Obtenir la couleur de l'équipe
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
                    <div class="message-text">${formatMessageContent(message.content)}</div>
                </div>
            </div>
        `;

        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();

        console.log('🎯 Message affiché avec succès dans l\'interface');
    }

    // Envoyer un message - VERSION AMÉLIORÉE AVEC EFFETS BOUTON
    async sendMessage() {
        // Protection contre les appels multiples
        if (this.isSending) {
            console.log('🚫 Envoi déjà en cours, ignoré');
            return;
        }

        if (!this.messageInput || !this.currentSalon || !this.authSystem.currentUser) {
            console.error('❌ Impossible d\'envoyer le message - données manquantes');
            return;
        }

        const content = this.messageInput.value.trim();
        if (!content) return;

        console.log('📤 Envoi du message:', content);

        // Marquer l'envoi comme en cours
        this.isSending = true;

        // ✨ NOUVEAUX EFFETS VISUELS DU BOUTON
        if (this.sendButton) {
            this.sendButton.classList.add('clicked');
            this.sendButton.disabled = true;
        }

        // Désactiver temporairement l'input pour éviter les envois multiples
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

            if (error) {
                console.error('❌ Erreur lors de l\'envoi du message:', error);
                alert('Erreur lors de l\'envoi du message');
                return;
            }

            // Vider l'input seulement après envoi réussi
            this.messageInput.value = '';

            // ✨ NOUVEAUX EFFETS DE SUCCÈS
            if (this.sendButton) {
                // Effet de succès vert
                const originalBackground = this.sendButton.style.background;
                setTimeout(() => {
                    this.sendButton.style.background = 'linear-gradient(135deg, #00ff88, #00cc66)';

                    setTimeout(() => {
                        this.sendButton.style.background = originalBackground;
                    }, 300);
                }, 100);
            }

            console.log('✅ Message envoyé avec succès - Realtime va l\'afficher');

        } catch (error) {
            console.error('❌ Erreur lors de l\'envoi du message:', error);
            alert('Erreur lors de l\'envoi du message');
        } finally {
            // Réactiver l'input et le bouton
            this.messageInput.disabled = false;

            if (this.sendButton) {
                this.sendButton.disabled = false;
                // Retirer la classe clicked après l'animation
                setTimeout(() => {
                    this.sendButton.classList.remove('clicked');
                }, 600);
            }

            this.messageInput.focus();

            // ✨ METTRE À JOUR L'ÉTAT DU BOUTON
            updateSendButtonState();

            // Libérer le verrou après 1 seconde
            setTimeout(() => {
                this.isSending = false;
            }, 1000);
        }
    }

    // Obtenir la couleur de l'équipe
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

    // Obtenir le nom de l'équipe
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

    // Sécuriser le contenu HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Faire défiler vers le bas
    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    // Quitter le salon actuel
    async leaveSalon() {
        if (this.subscription) {
            await window.supabaseClient.removeChannel(this.subscription);
            this.subscription = null;
        }
        this.currentSalon = null;
        console.log('Salon quitté');
    }

    // Nettoyer les ressources
    async cleanup() {
        await this.leaveSalon();
    }
}

// ===== NOUVEAUX EFFETS POUR LE BOUTON D'ENVOI =====
function initSendButtonEffects() {
    const messageInput = document.querySelector('#messageInput, .discussion-input input');
    const sendButton = document.querySelector('.send-button, .discussion-input button');

    if (!messageInput || !sendButton) {
        console.log('⚠️ Éléments du bouton d\'envoi non trouvés');
        return;
    }

    console.log('✨ Initialisation des effets du bouton d\'envoi');

    // Effet de pulsation quand il y a du contenu
    messageInput.addEventListener('input', function() {
        updateSendButtonState();
    });

    // État initial
    updateSendButtonState();
}

// Fonction pour mettre à jour l'état du bouton d'envoi
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

// ===== GESTION DE L'AUTHENTIFICATION =====
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('raceToWinUsers') || '[]');
        this.initializeEventListeners();
        this.checkAuthStatus();

        // Initialiser le gestionnaire de chat
        this.initializeChatManager();
    }

    // Nouvelle méthode pour initialiser le chat
    initializeChatManager() {
        // Attendre que l'utilisateur soit connecté
        setTimeout(() => {
            if (this.currentUser) {
                chatManager = new RealtimeChatManager(this);
                console.log('Chat manager initialisé');

                // Initialiser les effets du bouton après le chat
                setTimeout(() => {
                    initSendButtonEffects();
                }, 500);
            }
        }, 1000);
    }

    initializeEventListeners() {
        // Formulaire de connexion
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target.querySelector('input[type="email"]').value;
            const password = e.target.querySelector('input[type="password"]').value;
            await this.login(email, password);
        });

        // Formulaire d'inscription
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
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

        // Sélection d'équipe
        document.querySelectorAll('.team-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.team-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            });
        });

        // Événements des salons
        document.querySelectorAll('.discussion-card').forEach(card => {
            const team = card.dataset.team;
            const chatType = card.dataset.chat;

            // Event listener pour ouvrir le chat
            card.addEventListener('click', () => {
                this.openChat(chatType, team);
            });
        });

        // Initialiser le bouton profil
        setTimeout(() => {
            this.setupProfileButton();
        }, 100);
    }

    getTeamGradient(team) {
        const gradients = {
            ferrari: 'linear-gradient(145deg, rgba(255, 40, 0, 0.15), rgba(10, 10, 10, 0.9))',
            mercedes: 'linear-gradient(145deg, rgba(0, 210, 190, 0.15), rgba(10, 10, 10, 0.9))',
            redbull: 'linear-gradient(145deg, rgba(0, 102, 204, 0.15), rgba(10, 10, 10, 0.9))',
            mclaren: 'linear-gradient(145deg, rgba(255, 135, 0, 0.15), rgba(10, 10, 10, 0.9))',
            astonmartin: 'linear-gradient(145deg, rgba(0, 111, 98, 0.15), rgba(10, 10, 10, 0.9))',
            alpine: 'linear-gradient(145deg, rgba(255, 107, 157, 0.15), rgba(10, 10, 10, 0.9))',
            williams: 'linear-gradient(145deg, rgba(0, 160, 228, 0.15), rgba(10, 10, 10, 0.9))',
            haas: 'linear-gradient(145deg, rgba(255, 0, 0, 0.15), rgba(10, 10, 10, 0.9))',
            visacashapp: 'linear-gradient(145deg, rgba(0, 102, 204, 0.15), rgba(10, 10, 10, 0.9))',
            stake: 'linear-gradient(145deg, rgba(0, 255, 0, 0.15), rgba(10, 10, 10, 0.9))',
            global: 'linear-gradient(145deg, rgba(153, 69, 255, 0.15), rgba(10, 10, 10, 0.9))'
        };
        return gradients[team] || gradients.global;
    }

    setupProfileButton() {
        const profileButton = document.getElementById('profileButton');
        console.log('Setup profile button:', profileButton);

        if (profileButton) {
            profileButton.replaceWith(profileButton.cloneNode(true));
            const newProfileButton = document.getElementById('profileButton');
            newProfileButton.addEventListener('click', (e) => {
                console.log('Profile button clicked!');
                e.preventDefault();
                e.stopPropagation();
                openProfilePage();
            });
            console.log('Profile button setup completed');
        } else {
            console.error('Profile button not found!');
        }
    }

    getSelectedTeam() {
        const selected = document.querySelector('.team-option.selected');
        return selected ? selected.dataset.team : null;
    }

    async login(email, password) {
        // Utiliser la fonction login du fichier supabase.js
        const user = await window.login(email, password);

        if (user) {
            this.currentUser = user;
            localStorage.setItem('raceToWinCurrentUser', JSON.stringify(user));
            this.showMainApp();
            this.updateProfileUI();
            this.updateChatAccess();
            setTimeout(() => {
                this.setupProfileButton();
                // ✨ Initialiser les effets du bouton après connexion
                initSendButtonEffects();
            }, 200);
        }
    }

    async register(userData) {
        // Utiliser la fonction register du fichier supabase.js
        const user = await window.register(userData);

        if (user) {
            this.currentUser = user;
            localStorage.setItem('raceToWinCurrentUser', JSON.stringify(user));
            this.showMainApp();
            this.updateProfileUI();
            this.updateChatAccess();
            setTimeout(() => {
                this.setupProfileButton();
                // ✨ Initialiser les effets du bouton après inscription
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
                // ✨ Initialiser les effets du bouton pour les utilisateurs déjà connectés
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

        // Initialiser le chat si pas encore fait
        if (!chatManager && this.currentUser) {
            chatManager = new RealtimeChatManager(this);

            // ✨ Initialiser les effets du bouton après le chat
            setTimeout(() => {
                initSendButtonEffects();
            }, 500);
        }
    }

    updateProfileUI() {
        if (!this.currentUser) return;

        const initial = this.currentUser.firstName.charAt(0).toUpperCase();

        const profileButton = document.getElementById('profileButton');
        if (profileButton) {
            profileButton.textContent = initial;
        }

        this.updateProfilePageData();

        const profileAvatar = document.getElementById('profileAvatar');
        const profileName = document.getElementById('profileName');
        const profileTeam = document.getElementById('profileTeam');

        if (profileAvatar) profileAvatar.textContent = initial;
        if (profileName) profileName.textContent = `${this.currentUser.firstName} (${this.currentUser.nickname})`;

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

        if (profileTeam) {
            profileTeam.textContent = teamNames[this.currentUser.favoriteTeam] || 'Aucune équipe';
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
    }

    updateProfilePageData() {
        if (!this.currentUser) return;

        const initial = this.currentUser.firstName.charAt(0).toUpperCase();

        const mainAvatar = document.getElementById('profileMainAvatar');
        if (mainAvatar) {
            mainAvatar.textContent = initial;
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

        // Logo au lieu du texte - VERSION COMPLÈTE AVEC TOUS LES LOGOS
        const teamLogos = {
            // Chat global
            global: 'https://1000marcas.net/wp-content/uploads/2020/01/logo-F1.png',

            // Toutes les équipes F1 2024-2025
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

        // Noms complets pour l'attribut alt
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
            stake: 'Salon Stake F1',
            visacashapp: 'Salon Visa Cash App RB'
        };

        // Obtenir le logo et le nom
        const logoUrl = teamLogos[chatType] || teamLogos.global;
        const teamName = teamNames[chatType] || 'Chat F1';

        // Debug - vérifier quelle équipe est sélectionnée
        console.log(`🏎️ Équipe: ${chatType} | Logo: ${logoUrl} | Nom: ${teamName}`);

        // Mise à jour du header avec le logo centré
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

        // Rejoindre le salon avec le chat temps réel
        if (chatManager) {
            const salonId = teamRequired || chatType;
            chatManager.joinSalon(salonId);
        }

        // ✨ Réinitialiser les effets du bouton lors du changement de salon
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
        // Nettoyer le chat
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

// ===== FONCTIONS POUR LA PAGE PROFIL =====

// Ouvrir la page profil (remplace l'ancien dropdown)
function openProfilePage() {
    console.log('openProfilePage called');

    const overlay = document.getElementById('profilePageOverlay');
    console.log('Profile overlay found:', overlay);

    const dropdown = document.querySelector('.profile-dropdown');

    if (dropdown) {
        dropdown.classList.remove('show');
    }

    if (overlay) {
        console.log('Opening profile page');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';

        if (authSystem && authSystem.currentUser) {
            authSystem.updateProfilePageData();
        }
    } else {
        console.error('Profile page overlay not found!');
    }
}

// Fermer la page profil
function closeProfilePage() {
    console.log('closeProfilePage called');

    const overlay = document.getElementById('profilePageOverlay');
    if (overlay) {
        overlay.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

// Toggle des préférences
function togglePreference(toggle) {
    toggle.classList.toggle('active');

    const label = toggle.previousElementSibling.textContent;
    const isActive = toggle.classList.contains('active');

    console.log(`Préférence "${label}" : ${isActive ? 'activée' : 'désactivée'}`);

    saveUserPreference(label, isActive);
}

// Sauvegarder les préférences utilisateur
function saveUserPreference(preference, value) {
    const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
    preferences[preference] = value;
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
}

// Fonctions d'action du profil
function editProfile() {
    console.log('Éditer le profil');
    alert('Fonctionnalité de modification du profil à implémenter');
    closeProfilePage();
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

// Fonction utilitaire pour obtenir les données utilisateur
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

// ===== CLASSE JEU DE RÉACTION AMÉLIORÉE =====
class ReactionGame {
    constructor(container) {
        this.container = container;
        this.gameState = 'waiting';
        this.lights = [false, false, false, false, false];
        this.isHolding = false;
        this.message = 'Appuyez et maintenez pour commencer';
        this.reactionTime = null;
        this.bestTime = parseInt(localStorage.getItem('reactionGameBestTime')) || null;
        this.gameStartTime = null;
        this.allLightsOnTime = null;
        this.timeoutRefs = [];

        this.init();
    }

    init() {
        this.render();
        this.attachEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="reaction-game-container">
                <div class="reaction-header">
                    <div class="reaction-logo">RÉACTION F1</div>
                    ${this.bestTime ? `<div class="reaction-best">🏆 Record : ${this.bestTime}ms</div>` : ''}
                </div>

                <div class="reaction-status">
                    <div class="status-message">${this.message}</div>
                    ${this.reactionTime ? `
                        <div class="reaction-time-display">
                            <span class="time-value">${this.reactionTime}</span>
                            <span class="time-unit">ms</span>
                        </div>
                        <div class="performance-indicator">${this.getPerformanceMessage(this.reactionTime)}</div>
                    ` : ''}
                </div>

                <div class="lights-container">
                    ${this.lights.map((isOn, index) =>
                        `<div class="light ${this.getLightClass(index, isOn)}" data-index="${index}"></div>`
                    ).join('')}
                </div>

                <div class="interaction-area">
                    ${this.getInteractionHTML()}
                </div>

                <div class="game-instructions">
                    <div class="instruction-line">
                        <span class="instruction-step">1.</span>
                        <span class="instruction-text">Maintenez le bouton</span>
                    </div>
                    <div class="instruction-line">
                        <span class="instruction-step">2.</span>
                        <span class="instruction-text">Attendez que toutes les lumières s'allument puis s'éteignent</span>
                    </div>
                    <div class="instruction-line">
                        <span class="instruction-step">3.</span>
                        <span class="instruction-text">Relâchez immédiatement</span>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    getInteractionHTML() {
        if (this.gameState === 'waiting' || this.gameState === 'ready' || this.gameState === 'playing') {
            return `
                <div class="hold-zone ${this.isHolding ? 'holding' : ''}" id="holdZone">
                    <div class="hold-indicator">
                        <div class="hold-icon">${this.getHoldIcon()}</div>
                        <div class="hold-text">${this.getHoldText()}</div>
                    </div>
                </div>
            `;
        } else {
            return `
                <button class="restart-button" id="restartButton">
                    <span class="restart-icon">↻</span>
                    <span class="restart-text">RECOMMENCER</span>
                </button>
            `;
        }
    }

    getHoldIcon() {
        switch(this.gameState) {
            case 'waiting': return '🏁';
            case 'ready': return '⏳';
            case 'playing': return '🚨';
            default: return '🏁';
        }
    }

    getHoldText() {
        switch(this.gameState) {
            case 'waiting': return 'APPUYEZ ET MAINTENEZ';
            case 'ready': return 'MAINTENEZ...';
            case 'playing': return 'ATTENDEZ...';
            default: return 'APPUYEZ ET MAINTENEZ';
        }
    }

    attachEventListeners() {
        const holdZone = document.getElementById('holdZone');
        const restartButton = document.getElementById('restartButton');

        if (holdZone) {
            const startEvents = ['mousedown', 'touchstart'];
            const endEvents = ['mouseup', 'touchend', 'mouseleave', 'touchcancel'];

            startEvents.forEach(event => {
                holdZone.addEventListener(event, (e) => {
                    e.preventDefault();
                    this.handleStart();
                });
            });

            endEvents.forEach(event => {
                holdZone.addEventListener(event, (e) => {
                    e.preventDefault();
                    this.handleEnd();
                });
            });

            holdZone.addEventListener('selectstart', (e) => e.preventDefault());
        }

        if (restartButton) {
            restartButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetGame();
            });
        }
    }

    handleStart() {
        if (this.gameState !== 'waiting') return;

        this.isHolding = true;
        this.startGame();
    }

    handleEnd() {
        this.isHolding = false;
        this.handleRelease();
    }

    startGame() {
        if (this.gameState !== 'waiting' || !this.isHolding) return;

        this.gameState = 'ready';
        this.message = 'Attendez le signal...';
        this.gameStartTime = Date.now();
        this.updateDisplay();
        this.lightSequence();
    }

    updateDisplay() {
        const statusMessage = document.querySelector('.status-message');
        const holdZone = document.getElementById('holdZone');
        const holdIcon = document.querySelector('.hold-icon');
        const holdText = document.querySelector('.hold-text');

        if (statusMessage) statusMessage.textContent = this.message;
        if (holdZone) holdZone.className = `hold-zone ${this.isHolding ? 'holding' : ''}`;
        if (holdIcon) holdIcon.textContent = this.getHoldIcon();
        if (holdText) holdText.textContent = this.getHoldText();

        this.updateLights();
    }

    async lightSequence() {
        const delays = [500, 400, 350, 300, 250];

        for (let i = 0; i < 5; i++) {
            if (this.gameState !== 'ready' && this.gameState !== 'playing') return;

            await new Promise(resolve => {
                const timeoutId = setTimeout(() => {
                    this.lights[i] = true;
                    this.updateLights();
                    resolve();
                }, delays[i]);
                this.timeoutRefs.push(timeoutId);
            });
        }

        this.gameState = 'playing';
        this.message = 'Prêt... Attendez...';
        this.updateDisplay();

        const waitTime = Math.random() * 3000 + 1000;

        const timeoutId = setTimeout(() => {
            if (this.gameState !== 'playing') return;

            this.allLightsOnTime = Date.now();
            this.lights = [false, false, false, false, false];
            this.message = 'MAINTENANT ! RELÂCHEZ !';
            this.updateDisplay();

            const failTimeoutId = setTimeout(() => {
                if (this.gameState === 'playing') {
                    this.gameState = 'fail';
                    this.message = 'Trop lent ! Réessayez';
                    this.setFailLights();
                    this.render();
                }
            }, 1000);
            this.timeoutRefs.push(failTimeoutId);
        }, waitTime);
        this.timeoutRefs.push(timeoutId);
    }

    updateLights() {
        const lights = document.querySelectorAll('.light');
        lights.forEach((light, index) => {
            light.className = `light ${this.getLightClass(index, this.lights[index])}`;
        });
    }

    handleRelease() {
        if (this.gameState === 'playing') {
            if (!this.allLightsOnTime) return;

            const reactionTimeMs = Date.now() - this.allLightsOnTime;

            if (this.lights.every(light => !light)) {
                this.gameState = 'success';
                this.reactionTime = reactionTimeMs;
                this.message = this.getSuccessMessage(reactionTimeMs);
                this.setSuccessLights();

                if (!this.bestTime || reactionTimeMs < this.bestTime) {
                    this.bestTime = reactionTimeMs;
                    localStorage.setItem('reactionGameBestTime', this.bestTime.toString());
                }
            } else {
                this.gameState = 'fail';
                this.message = 'Trop tôt ! Attendez que toutes les lumières s\'éteignent';
                this.setFailLights();
            }

            this.clearTimeouts();
            this.render();
        } else if (this.gameState === 'ready') {
            this.gameState = 'fail';
            this.message = 'Ne relâchez pas ! Maintenez jusqu\'au signal';
            this.setFailLights();
            this.clearTimeouts();
            this.render();
        }
    }

    setSuccessLights() {
        this.lights = [false, true, true, true, false];
    }

    setFailLights() {
        this.lights = [true, false, false, false, true];
    }

    resetGame() {
        this.gameState = 'waiting';
        this.lights = [false, false, false, false, false];
        this.message = 'Appuyez et maintenez pour commencer';
        this.reactionTime = null;
        this.isHolding = false;
        this.gameStartTime = null;
        this.allLightsOnTime = null;
        this.clearTimeouts();
        this.render();
    }

    clearTimeouts() {
        this.timeoutRefs.forEach(id => clearTimeout(id));
        this.timeoutRefs = [];
    }

    getLightClass(index, isOn) {
        if (!isOn) return 'light-off';

        if (this.gameState === 'fail' && (index === 0 || index === 4)) return 'light-red';
        if (this.gameState === 'success' && (index === 1 || index === 2 || index === 3)) return 'light-green';

        return 'light-on';
    }

    getSuccessMessage(time) {
        if (time < 200) return `Incroyable ! ${time}ms`;
        if (time < 300) return `Excellent ! ${time}ms`;
        if (time < 400) return `Très bien ! ${time}ms`;
        return `Pas mal ! ${time}ms`;
    }

    getPerformanceMessage(time) {
        if (!time) return '';
        if (time < 200) return '🏆 PILOTE PROFESSIONNEL';
        if (time < 300) return '⚡ RÉFLEXES EXCELLENTS';
        if (time < 400) return '👍 BON PILOTE';
        if (time < 500) return '📈 PEUT MIEUX FAIRE';
        return '🐌 ENTRAÎNEZ-VOUS !';
    }

    destroy() {
        this.clearTimeouts();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// ===== FONCTIONS UTILITAIRES POUR LE CHAT =====

// Afficher un message système dans le chat
function displaySystemMessage(message) {
    if (!chatManager || !chatManager.messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'message system';

    messageElement.innerHTML = `
        <div class="message-text">${message}</div>
    `;

    chatManager.messagesContainer.appendChild(messageElement);
    chatManager.scrollToBottom();
}

// Afficher un indicateur de connexion au salon
function showSalonConnectionStatus(salonId, status = 'connecting') {
    const discussionMessages = document.getElementById('discussionMessages');
    if (!discussionMessages) return;

    // Supprimer l'ancien indicateur s'il existe
    const existingStatus = discussionMessages.querySelector('.salon-connection-status');
    if (existingStatus) {
        existingStatus.remove();
    }

    // Créer le nouvel indicateur
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

    // Supprimer automatiquement après 3 secondes si connecté
    if (status === 'connected') {
        setTimeout(() => {
            if (statusElement.parentNode) {
                statusElement.remove();
            }
        }, 3000);
    }
}

// Fonction pour obtenir le nombre d'utilisateurs en ligne (simulé)
function getOnlineUsersCount(salonId) {
    // En production, vous pourriez tracker cela via Supabase
    return Math.floor(Math.random() * 50) + 10; // Simulé entre 10 et 59
}

// Fonction pour formater le temps relatif
function getTimeAgo(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInSeconds = Math.floor((now - messageDate) / 1000);

    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)}min`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)}h`;
    return messageDate.toLocaleDateString('fr-FR');
}

// Fonction pour détecter et formater les liens dans les messages
function formatMessageContent(content) {
    // Échapper le HTML
    const div = document.createElement('div');
    div.textContent = content;
    let escapedContent = div.innerHTML;

    // Détecter les URLs et les rendre cliquables
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    escapedContent = escapedContent.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');

    return escapedContent;
}

// Fonction pour jouer un son de notification (optionnel)
function playNotificationSound() {
    // Vous pouvez ajouter un fichier audio et le jouer ici
    // const audio = new Audio('notification.mp3');
    // audio.play().catch(e => console.log('Impossible de jouer le son:', e));
    console.log('🔔 Nouveau message reçu');
}

// ===== VARIABLES GLOBALES =====
let authSystem;
let currentReactionGame = null;
let chatManager = null;

// ===== FONCTIONS GLOBALES =====
function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(tabName + 'Form').classList.add('active');
}

function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const navTabs = document.querySelectorAll('.menu-item');
    navTabs.forEach(tab => tab.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');

    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        if ((tabName === 'news' && item.textContent.includes('Actualités')) ||
            (tabName === 'discussion-selection' && item.textContent.includes('Salons')) ||
            (tabName === 'jeux' && item.textContent.includes('Jeux'))) {
            item.classList.add('active');
        }
    });

    // ✨ Réinitialiser les effets du bouton lors du changement d'onglet
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

// ✨ NOUVELLE FONCTION SENDMESSAGE AMÉLIORÉE
function sendMessage() {
    // Utiliser le gestionnaire de chat temps réel
    if (chatManager) {
        chatManager.sendMessage();
    } else {
        console.error('Chat manager non initialisé');
        // Fallback vers l'ancien système si nécessaire
        console.log('Tentative de réinitialisation du chat manager...');
        if (authSystem && authSystem.currentUser) {
            chatManager = new RealtimeChatManager(authSystem);
            chatManager.sendMessage();
        }
    }
}

// Fonction pour initialiser le chat après connexion
function initializeRealtimeChat() {
    if (authSystem && authSystem.currentUser && !chatManager) {
        chatManager = new RealtimeChatManager(authSystem);
        console.log('Chat temps réel initialisé après connexion');

        // ✨ Initialiser les effets du bouton après le chat
        setTimeout(() => {
            initSendButtonEffects();
        }, 500);
    }
}

async function fetchRSSFeed() {
    const rssUrl = 'https://fr.motorsport.com/rss/f1/news/';
    try {
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
        const data = await response.json();
        const feedContainer = document.getElementById('rss-feed');

        feedContainer.innerHTML = '';

        const latestItems = data.items.slice(0, 10);

        latestItems.forEach(item => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';

            const newsCard = document.createElement('div');
            newsCard.className = 'news-card';

            let imageHtml = '<div class="news-image">📰</div>';
            if (item.enclosure && item.enclosure.link) {
                imageHtml = `<img src="${item.enclosure.link}" alt="${item.title}" class="news-image">`;
            }

            const escapedTitle = item.title.replace(/"/g, '&quot;');
            const escapedContent = item.description.replace(/"/g, '&quot;');

            newsCard.innerHTML = `
                ${imageHtml}
                <div class="news-content">
                    <div class="news-title">${escapedTitle}</div>
                    <div class="news-meta">${new Date(item.pubDate).toLocaleString()}</div>
                    <div class="news-excerpt" style="white-space: normal; overflow: visible; word-wrap: break-word;">${escapedContent}</div>
                </div>
            `;

            slide.appendChild(newsCard);
            feedContainer.appendChild(slide);
        });

        var swiper = new Swiper('.swiper-container', {
            slidesPerView: 1,
            spaceBetween: 10,
            loop: true,
            autoplay: {
                delay: 10000,
                disableOnInteraction: false,
            },
        });

    } catch (error) {
        console.error('Error fetching RSS feed:', error);
    }
}

function openArticle(title, content) {
    document.getElementById('articleTitle').textContent = title;
    document.getElementById('articleContent').textContent = content;
    document.getElementById('articleReader').style.display = 'block';
}

function closeArticle() {
    document.getElementById('articleReader').style.display = 'none';
}

// ===== INITIALISATION PRINCIPALE AMÉLIORÉE =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');

    // Initialiser le système d'authentification
    authSystem = new AuthSystem();

    // Initialiser l'interface de discussion
    setTimeout(() => {
        initializeDiscussionInterface();
    }, 100);

    // Initialiser le bouton profil
    setTimeout(() => {
        const profileButton = document.getElementById('profileButton');
        console.log('Direct profile button check:', profileButton);

        if (profileButton) {
            console.log('Adding direct event listener to profile button');
            profileButton.replaceWith(profileButton.cloneNode(true));

            const newProfileButton = document.getElementById('profileButton');
            newProfileButton.addEventListener('click', function(e) {
                console.log('Direct profile button clicked!');
                e.preventDefault();
                e.stopPropagation();
                openProfilePage();
            });
        }
    }, 500);

    // Initialiser le chat temps réel après authentification
    setTimeout(() => {
        if (authSystem && authSystem.currentUser && !chatManager) {
            chatManager = new RealtimeChatManager(authSystem);
            console.log('Chat temps réel initialisé au démarrage');

            // ✨ Initialiser les effets du bouton après le chat
            setTimeout(() => {
                initSendButtonEffects();
            }, 500);
        }
    }, 1500);

    // ⚠️ IMPORTANT: Event listeners uniques pour les messages - VERSION AMÉLIORÉE
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        // Supprimer tous les anciens listeners
        const newMessageInput = messageInput.cloneNode(true);
        messageInput.parentNode.replaceChild(newMessageInput, messageInput);

        // Ajouter les nouveaux listeners avec les effets
        newMessageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                console.log('⌨️ Entrée pressée - envoi via chat manager');
                sendMessage();
            }
        });

        // ✨ NOUVEL EVENT LISTENER POUR LES EFFETS
        newMessageInput.addEventListener('input', function() {
            updateSendButtonState();
        });

        console.log('🔌 Event listeners uniques ajoutés à l\'input message avec effets');
    }

    // Event listener unique pour le bouton d'envoi - VERSION AMÉLIORÉE
    const sendButton = document.querySelector('.discussion-input button, .send-button');
    if (sendButton) {
        // Supprimer tous les anciens listeners
        const newSendButton = sendButton.cloneNode(true);
        sendButton.parentNode.replaceChild(newSendButton, sendButton);

        // Ajouter le nouveau listener
        newSendButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🖱️ Bouton cliqué - envoi via chat manager');
            sendMessage();
        });

        // ✨ AJOUTER LA CLASSE SEND-BUTTON SI PAS PRÉSENTE
        if (!newSendButton.classList.contains('send-button')) {
            newSendButton.classList.add('send-button');
        }

        console.log('🔌 Event listener unique ajouté au bouton d\'envoi avec effets');
    }

    // ✨ INITIALISER LES EFFETS DU BOUTON IMMÉDIATEMENT
    setTimeout(() => {
        initSendButtonEffects();
    }, 2000);

    // Événements pour le profil
    const profileOverlay = document.getElementById('profilePageOverlay');
    if (profileOverlay) {
        profileOverlay.addEventListener('click', function(e) {
            if (e.target === profileOverlay) {
                closeProfilePage();
            }
        });
    }

    // Gérer la touche Échap
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('profilePageOverlay');
            if (overlay && overlay.classList.contains('show')) {
                closeProfilePage();
            }
        }
    });

    // Charger le flux RSS
    fetchRSSFeed();
    setInterval(fetchRSSFeed, 5 * 60 * 1000);

    // Animations pour les cartes de discussion
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

    // Nettoyer le chat lors de la fermeture de la page
    window.addEventListener('beforeunload', function() {
        if (chatManager) {
            chatManager.cleanup();
        }
    });

    console.log('✨ Application Race to Win initialisée avec chat temps réel et bouton d\'envoi amélioré');
});
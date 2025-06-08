class PaddockF1 {
    constructor() {
        this.baseUrl = 'https://f1api.dev/api';
        this.currentTab = 'drivers';
        this.driversData = [];
        this.teamsData = [];
        this.isLoading = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        console.log('🚀 PaddockF1 initialisé');

        this.currentTab = 'drivers';
        this.syncTabInterface();
        this.showLoading('driversGrid');
        await this.loadDrivers();
    }

    setupEventListeners() {
        document.querySelectorAll('.paddock-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    switchTab(tabName) {
        console.log(`🔄 Changement vers onglet: ${tabName}`);

        document.querySelectorAll('.paddock-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.querySelectorAll('.paddock-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(tabName + '-tab');
        if (targetContent) {
            targetContent.classList.add('active');
        }

        this.currentTab = tabName;

        if (tabName === 'drivers') {
            if (this.driversData.length === 0) {
                this.showLoading('driversGrid');
                this.loadDrivers();
            } else {
                this.displayDrivers();
            }
        } else if (tabName === 'teams') {
            if (this.teamsData.length === 0) {
                this.showLoading('teamsGrid');
                this.loadTeams();
            } else {
                this.displayTeams();
            }
        }
    }

    async loadDrivers() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const response = await this.fetchAPI('/current/drivers');
            if (!response.drivers) {
                throw new Error('Aucun pilote trouvé');
            }

            const driversWithStats = await Promise.all(
                response.drivers.map(async (driver) => {
                    try {
                        const detailsResponse = await this.fetchAPI('/current/drivers/' + driver.driverId);
                        const seasonStats = this.calculateSeasonStats(detailsResponse.results || []);

                        return {
                            ...driver,
                            teamName: detailsResponse.team?.teamName || 'Équipe F1',
                            teamId: detailsResponse.team?.teamId || null,
                            seasonStats
                        };
                    } catch (error) {
                        return {
                            ...driver,
                            teamName: 'Équipe F1',
                            teamId: null,
                            seasonStats: { wins: 0, poles: 0, podiums: 0, points: 0 }
                        };
                    }
                })
            );

            this.driversData = driversWithStats;
            console.log(`✅ ${this.driversData.length} pilotes chargés`);

            if (this.currentTab === 'drivers') {
                this.displayDrivers();
            }

        } catch (error) {
            console.error('❌ Erreur chargement pilotes:', error);
            this.showError('driversGrid', 'Impossible de charger les pilotes');
        } finally {
            this.isLoading = false;
        }
    }

    async loadTeams() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            if (this.driversData.length === 0) {
                await this.loadDriversForTeamStats();
            }

            const response = await this.fetchAPI('/current/teams');
            if (!response.teams) {
                throw new Error('Aucune équipe trouvée');
            }

            this.teamsData = response.teams.map(team => ({
                ...team,
                seasonStats: this.calculateTeamStats(team.teamId)
            }));

            console.log(`✅ ${this.teamsData.length} équipes chargées`);

            if (this.currentTab === 'teams') {
                this.displayTeams();
            }

        } catch (error) {
            console.error('❌ Erreur chargement équipes:', error);
            this.showError('teamsGrid', 'Impossible de charger les équipes');
        } finally {
            this.isLoading = false;
        }
    }

    async loadDriversForTeamStats() {
        const response = await this.fetchAPI('/current/drivers');
        if (!response.drivers) return;

        const driversWithStats = await Promise.all(
            response.drivers.map(async (driver) => {
                try {
                    const detailsResponse = await this.fetchAPI('/current/drivers/' + driver.driverId);
                    const seasonStats = this.calculateSeasonStats(detailsResponse.results || []);

                    return {
                        ...driver,
                        teamName: detailsResponse.team?.teamName || 'Équipe F1',
                        teamId: detailsResponse.team?.teamId || null,
                        seasonStats
                    };
                } catch (error) {
                    return {
                        ...driver,
                        teamName: 'Équipe F1',
                        teamId: null,
                        seasonStats: { wins: 0, poles: 0, podiums: 0, points: 0 }
                    };
                }
            })
        );

        this.driversData = driversWithStats;
    }

    displayDrivers() {
        const grid = document.getElementById('driversGrid');
        if (!grid) return;

        grid.innerHTML = '';

        const sortedDrivers = this.driversData.slice().sort((a, b) => {
            return (b.seasonStats?.points || 0) - (a.seasonStats?.points || 0);
        });

        if (sortedDrivers.length === 0) {
            grid.innerHTML = '<p class="no-results">Aucun pilote trouvé</p>';
            return;
        }

        const container = document.createElement('div');
        container.className = 'rankings-container';
        container.innerHTML = sortedDrivers
            .map((driver, index) => this.createDriverCard(driver, index + 1))
            .join('');

        grid.appendChild(container);
        console.log(`✅ ${sortedDrivers.length} pilotes affichés`);
    }

    displayTeams() {
        const grid = document.getElementById('teamsGrid');
        if (!grid) return;

        grid.innerHTML = '';

        const sortedTeams = this.teamsData.slice().sort((a, b) => {
            return (b.seasonStats?.points || 0) - (a.seasonStats?.points || 0);
        });

        if (sortedTeams.length === 0) {
            grid.innerHTML = '<p class="no-results">Aucune équipe trouvée</p>';
            return;
        }

        const container = document.createElement('div');
        container.className = 'rankings-container';
        container.innerHTML = sortedTeams
            .map((team, index) => this.createTeamCard(team, index + 1))
            .join('');

        grid.appendChild(container);
        console.log(`✅ ${sortedTeams.length} équipes affichées`);
    }

    createDriverCard(driver, position) {
        const driverName = (driver.name + ' ' + driver.surname).replace(/'/g, '&apos;');
        const teamName = (driver.teamName || 'F1').replace(/'/g, '&apos;');
        const stats = driver.seasonStats || { wins: 0, poles: 0, podiums: 0, points: 0 };
        const teamColor = this.getTeamColor(driver.teamName || 'F1');
        const statsJson = JSON.stringify(stats).replace(/"/g, '&quot;');

        return `
            <div class="ranking-card" onclick="showDriverModal('${driver.driverId}', '${driverName}', '${teamName}', '${statsJson}', '${teamColor}', ${position})">
                <div class="position ${position <= 3 ? 'podium' : ''}">${position.toString().padStart(2, '0')}</div>
                <div class="driver-info">
                    <div class="driver-name">${driverName}</div>
                    <div class="team-name" style="color: ${teamColor}">${teamName}</div>
                </div>
                <div class="stats">
                    <div class="points">${stats.points}</div>
                    <div class="stats-mini">
                        <span class="wins">${stats.wins}W</span>
                        <span class="podiums">${stats.podiums}P</span>
                        <span class="poles">${stats.poles}PP</span>
                    </div>
                </div>
            </div>
        `;
    }

    createTeamCard(team, position) {
        const teamName = team.teamName.replace(/'/g, '&apos;');
        const stats = team.seasonStats || { wins: 0, poles: 0, podiums: 0, points: 0 };
        const teamColor = this.getTeamColor(teamName);
        const statsJson = JSON.stringify(stats).replace(/"/g, '&quot;');

        return `
            <div class="ranking-card" onclick="showTeamModal('${team.teamId || team.id}', '${teamName}', '${statsJson}', '${teamColor}', ${position})">
                <div class="position ${position <= 3 ? 'podium' : ''}">${position.toString().padStart(2, '0')}</div>
                <div class="driver-info">
                    <div class="driver-name">${teamName}</div>
                </div>
                <div class="stats">
                    <div class="points">${stats.points}</div>
                    <div class="stats-mini">
                        <span class="wins">${stats.wins}W</span>
                        <span class="podiums">${stats.podiums}P</span>
                        <span class="poles">${stats.poles}PP</span>
                    </div>
                </div>
            </div>
        `;
    }

    async fetchAPI(endpoint) {
        const url = this.baseUrl + endpoint;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return await response.json();
    }

    calculateSeasonStats(results) {
        const stats = { wins: 0, poles: 0, podiums: 0, points: 0 };

        if (!results || !Array.isArray(results)) {
            return stats;
        }

        results.forEach(result => {
            const raceResult = result.result;
            if (!raceResult) return;

            if (raceResult.finishingPosition === 1) stats.wins++;
            if (raceResult.gridPosition === 1) stats.poles++;
            if (raceResult.finishingPosition >= 1 && raceResult.finishingPosition <= 3) stats.podiums++;
            stats.points += raceResult.pointsObtained || 0;

            const sprintResult = result.sprintResult;
            if (sprintResult) {
                if (sprintResult.finishingPosition === 1) stats.wins++;
                if (sprintResult.finishingPosition >= 1 && sprintResult.finishingPosition <= 3) stats.podiums++;
                stats.points += sprintResult.pointsObtained || 0;
            }
        });

        return stats;
    }

    calculateTeamStats(teamId) {
        const teamDrivers = this.driversData.filter(driver => driver.teamId === teamId);
        const stats = { wins: 0, poles: 0, podiums: 0, points: 0 };

        teamDrivers.forEach(driver => {
            if (driver.seasonStats) {
                stats.wins += driver.seasonStats.wins;
                stats.poles += driver.seasonStats.poles;
                stats.podiums += driver.seasonStats.podiums;
                stats.points += driver.seasonStats.points;
            }
        });

        return stats;
    }

    getTeamColor(teamName) {
        const teamColors = {
            'McLaren': '#FF8000',
            'Ferrari': '#DC143C',
            'Red Bull': '#0600EF',
            'Mercedes': '#00D2BE',
            'Aston Martin': '#006F62',
            'Alpine': '#0090FF',
            'Williams': '#005AFF',
            'Haas': '#FFFFFF',
            'Stake': '#52E252',
            'Visa Cash App': '#6692FF'
        };

        for (const team in teamColors) {
            if (teamName.includes(team)) {
                return teamColors[team];
            }
        }

        return '#8B5CF6';
    }

    syncTabInterface() {
        document.querySelectorAll('.paddock-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === this.currentTab);
        });

        document.querySelectorAll('.paddock-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(this.currentTab + '-tab');
        if (targetContent) {
            targetContent.classList.add('active');
        }
    }

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Chargement des données...</p>
                </div>
            `;
        }
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="error-container">
                    <p>❌ ${message}</p>
                    <button onclick="window.paddockF1.${elementId === 'driversGrid' ? 'loadDrivers' : 'loadTeams'}()" class="retry-btn">
                        Réessayer
                    </button>
                </div>
            `;
        }
    }
}

// Styles CSS optimisés pour mobile
const styles = `
    /* Base - Container avec padding adaptatif */
    .rankings-container {
        max-width: 100%;
        margin: 0 auto;
        padding: 0 12px;
        box-sizing: border-box;
    }

    /* Onglets */
    .paddock-tabs {
        display: flex;
        justify-content: center;
        gap: 4px;
        margin-bottom: 20px;
        background: rgba(30, 27, 75, 0.3);
        border-radius: 12px;
        padding: 6px;
        max-width: 100%;
        margin-left: auto;
        margin-right: auto;
        box-sizing: border-box;
    }

    /* Reset des marges par défaut */
    .paddock-content {
        margin-top: 0px !important;
        padding-top: 0px !important;
    }

    .paddock-tab-content {
        margin-top: 0px !important;
        padding-top: 0px !important;
    }

    /* Espacement pour les grilles */
    .drivers-grid,
    .teams-grid {
        margin-top: 0px;
    }

    .paddock-tab {
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        flex: 1;
        text-align: center;
        min-width: 0;
    }

    .paddock-tab:hover {
        background: rgba(139, 92, 246, 0.2);
        color: rgba(255, 255, 255, 0.9);
    }

    .paddock-tab.active {
        background: linear-gradient(135deg, #8B5CF6, #A855F7);
        color: white;
        box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
    }

    /* Cartes de classement - Responsive */
    .ranking-card {
        background: rgba(30, 27, 75, 0.4);
        border: 1px solid rgba(139, 92, 246, 0.2);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
        width: 100%;
        box-sizing: border-box;
        min-width: 0;
    }

    .ranking-card:hover {
        background: rgba(139, 92, 246, 0.15);
        border-color: rgba(139, 92, 246, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(139, 92, 246, 0.2);
    }

    /* Position */
    .position {
        font-size: 22px;
        font-weight: 900;
        color: white;
        min-width: 40px;
        max-width: 40px;
        text-align: center;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 6px 0;
        flex-shrink: 0;
    }

    .position.podium {
        background: linear-gradient(135deg, #8B5CF6, #A855F7);
        box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
    }

    /* Infos pilote/équipe */
    .driver-info {
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }

    .driver-name {
        font-size: 16px;
        font-weight: 700;
        color: white;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .team-name {
        font-size: 12px;
        font-weight: 500;
        opacity: 0.8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Statistiques */
    .stats {
        text-align: right;
        min-width: 80px;
        max-width: 80px;
        flex-shrink: 0;
    }

    .points {
        font-size: 24px;
        font-weight: 900;
        color: #8B5CF6;
        line-height: 1;
        margin-bottom: 4px;
    }

    .stats-mini {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        font-size: 10px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        flex-wrap: wrap;
    }

    .wins { color: #10B981; }
    .podiums { color: #F59E0B; }
    .poles { color: #EF4444; }

    /* Loading et erreurs */
    .loading-container,
    .error-container {
        text-align: center;
        padding: 40px 20px;
        color: rgba(255, 255, 255, 0.8);
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(139, 92, 246, 0.2);
        border-top: 3px solid #8B5CF6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .retry-btn {
        margin-top: 16px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #8B5CF6, #A855F7);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .retry-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 32px rgba(139, 92, 246, 0.3);
    }

    /* Modal */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(15px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
    }

    .modal-content {
        background: linear-gradient(135deg, rgba(20, 20, 30, 0.98), rgba(30, 30, 45, 0.95));
        border: 2px solid var(--team-color, #8B5CF6);
        border-radius: 20px;
        padding: 32px;
        max-width: 500px;
        width: 100%;
        position: relative;
        backdrop-filter: blur(25px);
        box-sizing: border-box;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 
            0 0 60px var(--team-color-alpha, rgba(139, 92, 246, 0.4)),
            0 20px 80px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        animation: modalGlow 2s ease-in-out infinite alternate;
    }

    @keyframes modalGlow {
        0% {
            box-shadow: 
                0 0 60px var(--team-color-alpha, rgba(139, 92, 246, 0.3)),
                0 20px 80px rgba(0, 0, 0, 0.8),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        100% {
            box-shadow: 
                0 0 100px var(--team-color-alpha, rgba(139, 92, 246, 0.5)),
                0 30px 100px rgba(0, 0, 0, 0.9),
                inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }
    }

    .modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid var(--team-color, #8B5CF6);
        color: white;
        font-size: 20px;
        width: 36px;
        height: 36px;
        border-radius: 18px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal-close:hover {
        background: var(--team-color-alpha, rgba(139, 92, 246, 0.2));
        transform: scale(1.1);
    }

    .modal-title {
        font-size: 28px;
        font-weight: 900;
        color: white;
        margin-bottom: 8px;
        text-align: center;
        line-height: 1.2;
        text-shadow: 0 0 20px var(--team-color, #8B5CF6);
        animation: titlePulse 2s ease-in-out infinite alternate;
    }

    @keyframes titlePulse {
        0% {
            text-shadow: 0 0 20px var(--team-color, #8B5CF6);
        }
        100% {
            text-shadow: 
                0 0 30px var(--team-color, #8B5CF6),
                0 0 60px var(--team-color-alpha, rgba(139, 92, 246, 0.5));
        }
    }

    .modal-subtitle {
        font-size: 14px;
        color: var(--team-color, rgba(139, 92, 246, 0.8));
        text-align: center;
        margin-bottom: 24px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .modal-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 20px;
    }

    .modal-stat-card {
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(20, 20, 30, 0.4));
        border: 1px solid var(--team-color-alpha, rgba(139, 92, 246, 0.3));
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        position: relative;
        overflow: hidden;
    }

    .modal-stat-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, var(--team-color-alpha, rgba(139, 92, 246, 0.1)), transparent);
        animation: shimmer 3s infinite;
    }

    @keyframes shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
    }

    .modal-stat-value {
        font-size: 32px;
        font-weight: 900;
        color: var(--team-color, #8B5CF6);
        line-height: 1;
        margin-bottom: 6px;
        text-shadow: 0 0 15px var(--team-color-alpha, rgba(139, 92, 246, 0.6));
        position: relative;
        z-index: 1;
    }

    .modal-stat-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .modal-details {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
    }

    .modal-detail-card {
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(20, 20, 30, 0.2));
        border: 1px solid var(--team-color-alpha, rgba(139, 92, 246, 0.2));
        border-radius: 8px;
        padding: 12px;
        text-align: center;
    }

    .modal-detail-value {
        font-size: 20px;
        font-weight: 900;
        color: white;
        margin-bottom: 4px;
        text-shadow: 0 0 10px var(--team-color-alpha, rgba(139, 92, 246, 0.3));
    }

    .modal-detail-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
    }

    /* Responsive Mobile First */
    @media (max-width: 480px) {
        .rankings-container {
            padding: 0 8px;
        }

        .paddock-tabs {
            margin-bottom: 20px;
            padding: 4px;
        }

        .paddock-tab {
            padding: 8px 12px;
            font-size: 11px;
        }

        .ranking-card {
            padding: 12px;
            gap: 10px;
            margin-bottom: 8px;
        }

        .position {
            font-size: 18px;
            min-width: 35px;
            max-width: 35px;
            padding: 4px 0;
        }

        .driver-name {
            font-size: 14px;
        }

        .team-name {
            font-size: 11px;
        }

        .stats {
            min-width: 70px;
            max-width: 70px;
        }

        .points {
            font-size: 20px;
        }

        .stats-mini {
            gap: 4px;
            font-size: 9px;
        }

        .modal-content {
            padding: 20px;
            margin: 10px;
        }

        .modal-title {
            font-size: 24px;
        }

        .modal-stats {
            gap: 12px;
            margin-bottom: 16px;
        }

        .modal-stat-card {
            padding: 12px;
        }

        .modal-stat-value {
            font-size: 28px;
        }

        .modal-details {
            gap: 8px;
        }

        .modal-detail-card {
            padding: 10px;
        }

        .modal-detail-value {
            font-size: 18px;
        }
    }

    /* Tablettes */
    @media (min-width: 481px) and (max-width: 768px) {
        .rankings-container {
            padding: 0 16px;
        }

        .ranking-card {
            padding: 16px;
            gap: 16px;
        }

        .position {
            font-size: 24px;
            min-width: 45px;
            max-width: 45px;
        }

        .driver-name {
            font-size: 18px;
        }

        .points {
            font-size: 28px;
        }

        .stats {
            min-width: 90px;
            max-width: 90px;
        }
    }

    /* Desktop */
    @media (min-width: 769px) {
        .rankings-container {
            max-width: 800px;
            padding: 0 24px;
        }

        .ranking-card {
            padding: 20px;
            gap: 20px;
        }

        .position {
            font-size: 28px;
            min-width: 50px;
            max-width: 50px;
        }

        .driver-name {
            font-size: 20px;
        }

        .points {
            font-size: 32px;
        }

        .stats {
            min-width: 120px;
            max-width: 120px;
        }

        .stats-mini {
            gap: 12px;
            font-size: 12px;
        }
    }
`;

// Fonction pour convertir hex en rgba
function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Fonctions globales pour les modals
window.showDriverModal = function(driverId, driverName, teamName, statsJson, teamColor, position) {
    const stats = JSON.parse(statsJson.replace(/&quot;/g, '"'));
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    // Définir les variables CSS pour la couleur de l'équipe
    const teamColorAlpha3 = hexToRgba(teamColor, 0.3);
    const teamColorAlpha4 = hexToRgba(teamColor, 0.4);
    const teamColorAlpha5 = hexToRgba(teamColor, 0.5);

    modal.innerHTML = `
        <div class="modal-content" style="
            --team-color: ${teamColor};
            --team-color-alpha: ${teamColorAlpha3};
            border: 2px solid ${teamColor};
            box-shadow: 
                0 0 60px ${teamColorAlpha4},
                0 20px 80px rgba(0, 0, 0, 0.8),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
        ">
            <button class="modal-close" onclick="closeModal()" style="
                border-color: ${teamColor};
            ">×</button>
            <h1 class="modal-title" style="text-shadow: 0 0 20px ${teamColor};">${driverName}</h1>
            <div class="modal-subtitle" style="color: ${teamColor};">${teamName} • Saison 2025</div>

            <div class="modal-stats">
                <div class="modal-stat-card" style="
                    border-color: ${teamColorAlpha3};
                ">
                    <div class="modal-stat-value" style="
                        color: ${teamColor};
                        text-shadow: 0 0 15px ${teamColorAlpha5};
                    ">${position.toString().padStart(2, '0')}</div>
                    <div class="modal-stat-label">Position</div>
                </div>
                <div class="modal-stat-card" style="
                    border-color: ${teamColorAlpha3};
                ">
                    <div class="modal-stat-value" style="
                        color: ${teamColor};
                        text-shadow: 0 0 15px ${teamColorAlpha5};
                    ">${stats.points}</div>
                    <div class="modal-stat-label">Points</div>
                </div>
            </div>

            <div class="modal-details">
                <div class="modal-detail-card" style="border-color: ${hexToRgba(teamColor, 0.2)};">
                    <div class="modal-detail-value">${stats.wins}</div>
                    <div class="modal-detail-label">Victoires</div>
                </div>
                <div class="modal-detail-card" style="border-color: ${hexToRgba(teamColor, 0.2)};">
                    <div class="modal-detail-value">${stats.podiums}</div>
                    <div class="modal-detail-label">Podiums</div>
                </div>
                <div class="modal-detail-card" style="border-color: ${hexToRgba(teamColor, 0.2)};">
                    <div class="modal-detail-value">${stats.poles}</div>
                    <div class="modal-detail-label">Pôles</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.animation = 'fadeIn 0.3s ease';
};

window.showTeamModal = function(teamId, teamName, statsJson, teamColor, position) {
    const stats = JSON.parse(statsJson.replace(/&quot;/g, '"'));
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    // Définir les variables CSS pour la couleur de l'équipe
    const teamColorAlpha3 = hexToRgba(teamColor, 0.3);
    const teamColorAlpha4 = hexToRgba(teamColor, 0.4);
    const teamColorAlpha5 = hexToRgba(teamColor, 0.5);

    modal.innerHTML = `
        <div class="modal-content" style="
            --team-color: ${teamColor};
            --team-color-alpha: ${teamColorAlpha3};
            border: 2px solid ${teamColor};
            box-shadow: 
                0 0 60px ${teamColorAlpha4},
                0 20px 80px rgba(0, 0, 0, 0.8),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
        ">
            <button class="modal-close" onclick="closeModal()" style="
                border-color: ${teamColor};
            ">×</button>
            <h1 class="modal-title" style="text-shadow: 0 0 20px ${teamColor};">${teamName}</h1>
            <div class="modal-subtitle" style="color: ${teamColor};">Saison 2025</div>

            <div class="modal-stats">
                <div class="modal-stat-card" style="
                    border-color: ${teamColorAlpha3};
                ">
                    <div class="modal-stat-value" style="
                        color: ${teamColor};
                        text-shadow: 0 0 15px ${teamColorAlpha5};
                    ">${position.toString().padStart(2, '0')}</div>
                    <div class="modal-stat-label">Position</div>
                </div>
                <div class="modal-stat-card" style="
                    border-color: ${teamColorAlpha3};
                ">
                    <div class="modal-stat-value" style="
                        color: ${teamColor};
                        text-shadow: 0 0 15px ${teamColorAlpha5};
                    ">${stats.points}</div>
                    <div class="modal-stat-label">Points</div>
                </div>
            </div>

            <div class="modal-details">
                <div class="modal-detail-card" style="border-color: ${hexToRgba(teamColor, 0.2)};">
                    <div class="modal-detail-value">${stats.wins}</div>
                    <div class="modal-detail-label">Victoires</div>
                </div>
                <div class="modal-detail-card" style="border-color: ${hexToRgba(teamColor, 0.2)};">
                    <div class="modal-detail-value">${stats.podiums}</div>
                    <div class="modal-detail-label">Podiums</div>
                </div>
                <div class="modal-detail-card" style="border-color: ${hexToRgba(teamColor, 0.2)};">
                    <div class="modal-detail-value">${stats.poles}</div>
                    <div class="modal-detail-label">Pôles</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.animation = 'fadeIn 0.3s ease';
};

window.closeModal = function() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => modal.remove(), 300);
    }
};

// Ajout des styles CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = styles + `
    @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
    }

    @keyframes fadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.9); }
    }
`;
document.head.appendChild(styleSheet);

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM chargé - Initialisation PaddockF1');
    window.paddockF1 = new PaddockF1();

    const originalShowTab = window.showTab;
    window.showTab = function(tabName) {
        if (originalShowTab) {
            originalShowTab(tabName);
        }

        if (tabName === 'paddock' && window.paddockF1) {
            if (window.paddockF1.driversData.length === 0) {
                window.paddockF1.loadDrivers();
            }
        }
    };
});

window.showTeamDetails = function(teamId, teamName, stats, teamColor, position) {
    let modal = document.getElementById('driverDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'driverDetailsModal';
        modal.className = 'driver-details-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML =
        '<style>' +
            '.modal-ultra-dark { background: rgba(0, 0, 0, 0.98) !important; backdrop-filter: blur(20px) !important; }' +
            '.modal-container-' + teamColor.replace('#', '') + ' {' +
                'background: linear-gradient(45deg, rgba(2, 2, 2, 0.99) 0%, rgba(5, 5, 5, 0.98) 15%, ' + teamColor + '25 30%, rgba(8, 8, 8, 0.98) 45%, ' + teamColor + '20 60%, rgba(5, 5, 5, 0.99) 75%, rgba(2, 2, 2, 0.99) 100%) !important;' +
                'background-size: 1000% 1000% !important;' +
                'animation: ultraFlow 2.5s ease-in-out infinite, borderPulse 3s ease-in-out infinite alternate !important;' +
                'border: 3px solid ' + teamColor + ' !important;' +
                'box-shadow: 0 0 100px ' + teamColor + '50, 0 30px 80px rgba(0,0,0,0.95), inset 0 2px 0 rgba(255,255,255,0.03) !important;' +
            '}' +
            '.modal-shimmer-' + teamColor.replace('#', '') + '::before {' +
                'content: "" !important;' +
                'position: absolute !important;' +
                'top: -50% !important;' +
                'left: -50% !important;' +
                'width: 200% !important;' +
                'height: 200% !important;' +
                'background: linear-gradient(45deg, transparent 30%, ' + teamColor + '15 50%, transparent 70%) !important;' +
                'animation: shimmer 3s linear infinite !important;' +
                'pointer-events: none !important;' +
            '}' +
            '.title-glow-' + teamColor.replace('#', '') + ' {' +
                'color: #fff !important;' +
                'animation: titlePulse 2s ease-in-out infinite alternate !important;' +
                'text-shadow: 0 0 30px ' + teamColor + ', 0 0 60px ' + teamColor + '80, 0 4px 20px rgba(0,0,0,0.9) !important;' +
            '}' +
            '.points-mega-glow-' + teamColor.replace('#', '') + ' {' +
                'color: ' + teamColor + ' !important;' +
                'animation: pointsMegaPulse 1.5s ease-in-out infinite alternate !important;' +
                'text-shadow: 0 0 40px ' + teamColor + ', 0 0 80px ' + teamColor + '80, 0 0 120px ' + teamColor + '50, 0 4px 20px rgba(0,0,0,0.9) !important;' +
            '}' +
            '.card-float { animation: cardFloating 4s ease-in-out infinite !important; }' +
            '.stat-float { animation: statFloating 3.5s ease-in-out infinite !important; }' +
            '@keyframes ultraFlow {' +
                '0% { background-position: 0% 0%; }' +
                '25% { background-position: 100% 50%; }' +
                '50% { background-position: 50% 100%; }' +
                '75% { background-position: 0% 50%; }' +
                '100% { background-position: 0% 0%; }' +
            '}' +
            '@keyframes shimmer {' +
                '0% { transform: translate(-100%, -100%) rotate(45deg); }' +
                '100% { transform: translate(100%, 100%) rotate(45deg); }' +
            '}' +
            '@keyframes borderPulse {' +
                '0% { border-width: 3px; box-shadow: 0 0 100px ' + teamColor + '50, 0 30px 80px rgba(0,0,0,0.95); }' +
                '100% { border-width: 4px; box-shadow: 0 0 150px ' + teamColor + '70, 0 40px 100px rgba(0,0,0,0.95); }' +
            '}' +
            '@keyframes titlePulse {' +
                '0% { text-shadow: 0 0 30px ' + teamColor + ', 0 0 60px ' + teamColor + '80, 0 4px 20px rgba(0,0,0,0.9); }' +
                '100% { text-shadow: 0 0 50px ' + teamColor + ', 0 0 100px ' + teamColor + '90, 0 0 150px ' + teamColor + '50, 0 4px 20px rgba(0,0,0,0.9); }' +
            '}' +
            '@keyframes pointsMegaPulse {' +
                '0% { transform: scale(1); text-shadow: 0 0 40px ' + teamColor + ', 0 0 80px ' + teamColor + '80; }' +
                '100% { transform: scale(1.08); text-shadow: 0 0 60px ' + teamColor + ', 0 0 120px ' + teamColor + '90, 0 0 180px ' + teamColor + '60; }' +
            '}' +
            '@keyframes cardFloating {' +
                '0%, 100% { transform: translateY(0px) rotate(0deg); }' +
                '33% { transform: translateY(-4px) rotate(0.5deg); }' +
                '66% { transform: translateY(-2px) rotate(-0.3deg); }' +
            '}' +
            '@keyframes statFloating {' +
                '0%, 100% { transform: translateY(0px) scale(1); }' +
                '50% { transform: translateY(-3px) scale(1.03); }' +
            '}' +
        '</style>' +
        '<div class="modal-ultra-dark" style="position: fixed; top: 0; left: 0; width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; z-index: 1000;">' +
            '<div class="modal-container-' + teamColor.replace('#', '') + ' modal-shimmer-' + teamColor.replace('#', '') + '" style="border-radius: 20px; padding: 30px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative;">' +
                '<button onclick="closeDriverDetails()" style="position: absolute; top: 15px; right: 15px; background: rgba(0, 0, 0, 0.9); border: 2px solid ' + teamColor + '; color: #fff; font-size: 18px; width: 40px; height: 40px; border-radius: 20px; cursor: pointer; z-index: 10; transition: all 0.3s ease;">×</button>' +
                '<div style="text-align: center; position: relative; z-index: 2;">' +
                    '<h1 class="title-glow-' + teamColor.replace('#', '') + '" style="font-size: 32px; font-weight: 900; margin: 0 0 8px 0;">' + teamName + '</h1>' +
                    '<div style="color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 25px;">2025 Saison</div>' +
                    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">' +
                        '<div class="card-float" style="text-align: center; background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(3,3,3,0.9)); border-radius: 12px; padding: 20px; border: 1px solid ' + teamColor + '40;">' +
                            '<div style="font-size: 48px; font-weight: 900; color: #fff; line-height: 1;">' + (position || '01').toString().padStart(2, '0') + '</div>' +
                            '<div style="font-size: 12px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-top: 5px;">Position</div>' +
                        '</div>' +
                        '<div class="card-float" style="text-align: center; background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(3,3,3,0.9)); border-radius: 12px; padding: 20px; border: 1px solid ' + teamColor + '40; animation-delay: 0.5s;">' +
                            '<div class="points-mega-glow-' + teamColor.replace('#', '') + '" style="font-size: 48px; font-weight: 900; line-height: 1;">' + stats.points + '</div>' +
                            '<div style="font-size: 12px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-top: 5px;">Points</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">' +
                        '<div class="stat-float" style="background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(5,5,5,0.8)); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 15px; text-align: center;">' +
                            '<div style="font-size: 24px; font-weight: 900; color: #fff; margin-bottom: 5px;">' + stats.wins + '</div>' +
                            '<div style="font-size: 11px; color: rgba(255,255,255,0.4);">Victoires</div>' +
                        '</div>' +
                        '<div class="stat-float" style="background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(5,5,5,0.8)); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 15px; text-align: center; animation-delay: 0.3s;">' +
                            '<div style="font-size: 24px; font-weight: 900; color: #fff; margin-bottom: 5px;">' + stats.podiums + '</div>' +
                            '<div style="font-size: 11px; color: rgba(255,255,255,0.4);">Podiums</div>' +
                        '</div>' +
                        '<div class="stat-float" style="background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(5,5,5,0.8)); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 15px; text-align: center; animation-delay: 0.6s;">' +
                            '<div style="font-size: 24px; font-weight: 900; color: #fff; margin-bottom: 5px;">' + stats.poles + '</div>' +
                            '<div style="font-size: 11px; color: rgba(255,255,255,0.4);">Pôles</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

    modal.classList.add('active', 'modal-flip-in');
}; const seasonFocusedStyles = document.createElement('style');
seasonFocusedStyles.textContent =
    '.paddock-tabs {' +
        'display: flex;' +
        'justify-content: center;' +
        'gap: 12px;' +
        'margin-bottom: 30px;' +
        'background: transparent;' +
        'border: none;' +
        'padding: 0;' +
        'max-width: 500px;' +
        'margin-left: auto;' +
        'margin-right: auto;' +
    '}' +

    '.paddock-tab {' +
        'background: rgba(76, 29, 149, 0.15);' +
        'color: rgba(255, 255, 255, 0.85);' +
        'border: 1px solid rgba(139, 69, 255, 0.2);' +
        'border-radius: 10px;' +
        'padding: 14px 28px;' +
        'font-weight: 600;' +
        'font-size: 13px;' +
        'text-transform: uppercase;' +
        'letter-spacing: 1.2px;' +
        'cursor: pointer;' +
        'transition: all 0.25s ease;' +
        'margin: 0;' +
    '}' +

    '.paddock-tab:hover {' +
        'background: rgba(76, 29, 149, 0.25);' +
        'color: rgba(255, 255, 255, 1);' +
        'border-color: rgba(139, 69, 255, 0.4);' +
    '}' +

    '.paddock-tab.active {' +
        'background: linear-gradient(135deg, #8b45ff, #9d5cff);' +
        'color: #ffffff;' +
        'border-color: transparent;' +
        'box-shadow: 0 2px 12px rgba(139, 69, 255, 0.3);' +
    '}' +

    '.f1-rankings-container {' +
        'background: transparent;' +
        'border-radius: 0;' +
        'overflow: visible;' +
        'border: none;' +
        'box-shadow: none;' +
    '}' +

    '.f1-ranking-card {' +
        'background: rgba(76, 29, 149, 0.08);' +
        'border: 1px solid rgba(139, 69, 255, 0.15);' +
        'border-radius: 14px;' +
        'padding: 20px 24px;' +
        'display: flex;' +
        'align-items: center;' +
        'gap: 18px;' +
        'cursor: pointer;' +
        'transition: all 0.25s ease;' +
        'margin-bottom: 12px;' +
    '}' +

    '.f1-ranking-card:hover {' +
        'background: rgba(139, 69, 255, 0.15);' +
        'border-color: rgba(139, 69, 255, 0.3);' +
        'transform: translateY(-2px);' +
        'box-shadow: 0 4px 20px rgba(139, 69, 255, 0.15);' +
    '}' +

    '.f1-ranking-card:last-child {' +
        'margin-bottom: 0;' +
    '}' +

    '.ranking-position {' +
        'font-size: 24px;' +
        'font-weight: 800;' +
        'color: rgba(255, 255, 255, 0.9);' +
        'min-width: 48px;' +
        'text-align: center;' +
        'background: rgba(255, 255, 255, 0.05);' +
        'border-radius: 8px;' +
        'padding: 8px 0;' +
    '}' +

    '.f1-ranking-card:nth-child(1) .ranking-position {' +
        'color: #FFD700;' +
        'background: rgba(255, 215, 0, 0.1);' +
        'text-shadow: 0 0 8px rgba(255, 215, 0, 0.4);' +
    '}' +

    '.f1-ranking-card:nth-child(2) .ranking-position {' +
        'color: #C0C0C0;' +
        'background: rgba(192, 192, 192, 0.1);' +
        'text-shadow: 0 0 8px rgba(192, 192, 192, 0.4);' +
    '}' +

    '.f1-ranking-card:nth-child(3) .ranking-position {' +
        'color: #CD7F32;' +
        'background: rgba(205, 127, 50, 0.1);' +
        'text-shadow: 0 0 8px rgba(205, 127, 50, 0.4);' +
    '}' +

    '.points-display-main {' +
        'display: flex;' +
        'flex-direction: column;' +
        'align-items: flex-end;' +
        'text-align: right;' +
        'min-width: 70px;' +
    '}' +

    '.points-number {' +
        'font-size: 24px;' +
        'font-weight: 800;' +
        'color: rgba(255, 255, 255, 0.95);' +
        'line-height: 1;' +
    '}' +

    '.f1-ranking-card:nth-child(1) .points-number {' +
        'color: #FFD700;' +
        'text-shadow: 0 0 8px rgba(255, 215, 0, 0.4);' +
    '}' +

    '.f1-ranking-card:nth-child(2) .points-number {' +
        'color: #C0C0C0;' +
        'text-shadow: 0 0 8px rgba(192, 192, 192, 0.4);' +
    '}' +

    '.f1-ranking-card:nth-child(3) .points-number {' +
        'color: #CD7F32;' +
        'text-shadow: 0 0 8px rgba(205, 127, 50, 0.4);' +
    '}' +

    '.driver-info-main {' +
        'flex: 1;' +
        'display: flex;' +
        'flex-direction: column;' +
        'gap: 5px;' +
    '}' +

    '.driver-name-display {' +
        'font-size: 17px;' +
        'font-weight: 700;' +
        'color: rgba(255, 255, 255, 0.95);' +
        'line-height: 1.2;' +
    '}' +

    '.team-name-display {' +
        'font-size: 12px;' +
        'font-weight: 500;' +
        'opacity: 0.8;' +
        'text-transform: uppercase;' +
        'letter-spacing: 0.6px;' +
    '}' +

    '.points-label {' +
        'font-size: 10px;' +
        'color: rgba(255, 255, 255, 0.5);' +
        'text-transform: uppercase;' +
        'letter-spacing: 0.8px;' +
        'margin-top: 2px;' +
        'font-weight: 500;' +
    '}' +

    '.driver-details-modal {' +
        'position: fixed;' +
        'top: 0;' +
        'left: 0;' +
        'right: 0;' +
        'bottom: 0;' +
        'background: linear-gradient(135deg, #1a0b2e 0%, #2d1b69 50%, #16213e 100%);' +
        'z-index: 1000;' +
        'display: none;' +
        'overflow-y: auto;' +
    '}' +

    '.driver-details-modal.active {' +
        'display: block;' +
    '}' +

    '.loading-placeholder {' +
        'display: flex;' +
        'flex-direction: column;' +
        'align-items: center;' +
        'justify-content: center;' +
        'padding: 60px 20px;' +
        'color: rgba(255, 255, 255, 0.8);' +
        'text-align: center;' +
    '}' +

    '.loading-spinner {' +
        'width: 40px;' +
        'height: 40px;' +
        'border: 2px solid rgba(139, 69, 255, 0.2);' +
        'border-top: 2px solid #8b45ff;' +
        'border-radius: 50%;' +
        'animation: spin 1s linear infinite;' +
        'margin-bottom: 20px;' +
    '}' +

    '@keyframes spin {' +
        '0% { transform: rotate(0deg); }' +
        '100% { transform: rotate(360deg); }' +
    '}' +

    '.error-placeholder {' +
        'text-align: center;' +
        'padding: 50px 20px;' +
        'color: #ff6b6b;' +
    '}' +

    '.retry-btn {' +
        'margin-top: 16px;' +
        'padding: 10px 20px;' +
        'background: #8b45ff;' +
        'color: white;' +
        'border: none;' +
        'border-radius: 8px;' +
        'cursor: pointer;' +
        'font-weight: 600;' +
        'font-size: 13px;' +
        'transition: all 0.25s ease;' +
    '}' +

    '.retry-btn:hover {' +
        'background: #9d5cff;' +
        'transform: translateY(-1px);' +
    '}' +

    '@media (max-width: 768px) {' +
        '.f1-ranking-card { padding: 16px 20px; gap: 15px; margin-bottom: 10px; }' +
        '.ranking-position { font-size: 20px; min-width: 40px; padding: 6px 0; }' +
        '.driver-name-display { font-size: 16px; }' +
        '.points-number { font-size: 20px; }' +
        '.paddock-tab { padding: 12px 20px; font-size: 12px; }' +
        '.points-display-main { min-width: 60px; }' +
    '}' +

    '@media (max-width: 480px) {' +
        '.f1-ranking-card { padding: 14px 16px; gap: 12px; }' +
        '.ranking-position { font-size: 18px; min-width: 36px; }' +
        '.driver-name-display { font-size: 15px; }' +
        '.team-name-display { font-size: 11px; }' +
        '.points-number { font-size: 18px; }' +
        '.paddock-tab { padding: 10px 16px; }' +
    '}' +

    '.fade-in {' +
        'animation: fadeIn 0.4s ease-out;' +
    '}' +

    '@keyframes fadeIn {' +
        'from { opacity: 0; transform: translateY(10px); }' +
        'to { opacity: 1; transform: translateY(0); }' +
    '}' +

    '.modal-slide-up {' +
        'animation: modalSlideUp 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);' +
    '}' +

    '@keyframes modalSlideUp {' +
        '0% {' +
            'opacity: 0;' +
            'transform: translateY(100px) scale(0.9);' +
        '}' +
        '60% {' +
            'opacity: 0.8;' +
            'transform: translateY(-10px) scale(1.02);' +
        '}' +
        '100% {' +
            'opacity: 1;' +
            'transform: translateY(0) scale(1);' +
        '}' +
    '}' +

    '.modal-zoom-in {' +
        'animation: modalZoomIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);' +
    '}' +

    '@keyframes modalZoomIn {' +
        '0% {' +
            'opacity: 0;' +
            'transform: scale(0.3) rotate(-5deg);' +
        '}' +
        '50% {' +
            'opacity: 0.8;' +
            'transform: scale(1.05) rotate(1deg);' +
        '}' +
        '100% {' +
            'opacity: 1;' +
            'transform: scale(1) rotate(0deg);' +
        '}' +
    '}' +

    '.modal-flip-in {' +
        'animation: modalFlipIn 0.6s cubic-bezier(0.25, 0.8, 0.25, 1);' +
    '}' +

    '@keyframes modalFlipIn {' +
        '0% {' +
            'opacity: 0;' +
            'transform: perspective(1000px) rotateX(-90deg) translateY(50px);' +
        '}' +
        '60% {' +
            'opacity: 0.9;' +
            'transform: perspective(1000px) rotateX(10deg) translateY(-5px);' +
        '}' +
        '100% {' +
            'opacity: 1;' +
            'transform: perspective(1000px) rotateX(0deg) translateY(0px);' +
        '}' +
    '}' +

    '@keyframes gradientShift {' +
        '0% {' +
            'background-position: 0% 50%;' +
        '}' +
        '50% {' +
            'background-position: 100% 50%;' +
        '}' +
        '100% {' +
            'background-position: 0% 50%;' +
        '}' +
    '}' +

    '@keyframes ultraGradientFlow {' +
        '0% {' +
            'background-position: 0% 0%;' +
        '}' +
        '25% {' +
            'background-position: 100% 50%;' +
        '}' +
        '50% {' +
            'background-position: 50% 100%;' +
        '}' +
        '75% {' +
            'background-position: 0% 50%;' +
        '}' +
        '100% {' +
            'background-position: 0% 0%;' +
        '}' +
    '}' +

    '@keyframes shimmerEffect {' +
        '0% {' +
            'transform: translateX(-100%) rotate(45deg);' +
        '}' +
        '100% {' +
            'transform: translateX(200%) rotate(45deg);' +
        '}' +
    '}' +

    '@keyframes pulseBorder {' +
        '0% {' +
            'border-width: 2px;' +
            'box-shadow: 0 0 80px var(--team-color, #9945FF)40, 0 20px 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05);' +
        '}' +
        '100% {' +
            'border-width: 3px;' +
            'box-shadow: 0 0 120px var(--team-color, #9945FF)60, 0 30px 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08);' +
        '}' +
    '}' +

    '@keyframes titleGlow {' +
        '0% {' +
            'text-shadow: 0 0 20px var(--team-color, #9945FF)80, 0 4px 15px rgba(0,0,0,0.9);' +
        '}' +
        '100% {' +
            'text-shadow: 0 0 35px var(--team-color, #9945FF)100, 0 0 60px var(--team-color, #9945FF)40, 0 4px 15px rgba(0,0,0,0.9);' +
        '}' +
    '}' +

    '@keyframes teamGlow {' +
        '0% {' +
            'text-shadow: 0 0 15px var(--team-color, #9945FF)80, 0 0 30px var(--team-color, #9945FF)40;' +
        '}' +
        '100% {' +
            'text-shadow: 0 0 25px var(--team-color, #9945FF)100, 0 0 50px var(--team-color, #9945FF)60, 0 0 80px var(--team-color, #9945FF)30;' +
        '}' +
    '}' +

    '@keyframes pointsPulse {' +
        '0% {' +
            'transform: scale(1);' +
            'text-shadow: 0 0 25px var(--team-color, #9945FF)80, 0 0 50px var(--team-color, #9945FF)40, 0 4px 15px rgba(0,0,0,0.9);' +
        '}' +
        '50% {' +
            'transform: scale(1.05);' +
            'text-shadow: 0 0 40px var(--team-color, #9945FF)100, 0 0 80px var(--team-color, #9945FF)60, 0 0 120px var(--team-color, #9945FF)30, 0 4px 15px rgba(0,0,0,0.9);' +
        '}' +
        '100% {' +
            'transform: scale(1);' +
            'text-shadow: 0 0 25px var(--team-color, #9945FF)80, 0 0 50px var(--team-color, #9945FF)40, 0 4px 15px rgba(0,0,0,0.9);' +
        '}' +
    '}' +

    '@keyframes cardFloat {' +
        '0%, 100% {' +
            'transform: translateY(0px);' +
        '}' +
        '50% {' +
            'transform: translateY(-3px);' +
        '}' +
    '}' +

    '@keyframes statFloat {' +
        '0%, 100% {' +
            'transform: translateY(0px) scale(1);' +
        '}' +
        '50% {' +
            'transform: translateY(-2px) scale(1.02);' +
        '}' +
    '}';

document.head.appendChild(seasonFocusedStyles);

window.showDriverDetails = function(driverId, driverName, teamName, stats, teamColor, position) {
    let modal = document.getElementById('driverDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'driverDetailsModal';
        modal.className = 'driver-details-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML =
        '<div class="driver-details-header" style="background: linear-gradient(135deg, ' + teamColor + ' 0%, ' + teamColor + '80 50%, ' + teamColor + '60 100%); padding: 60px 40px 40px; position: relative; min-height: 100vh; overflow: hidden;">' +
            '<button class="driver-details-close" onclick="closeDriverDetails()" style="position: absolute; top: 30px; left: 30px; background: rgba(255, 255, 255, 0.2); border: none; color: #fff; font-size: 20px; width: 50px; height: 50px; border-radius: 25px; cursor: pointer; z-index: 10; transition: all 0.3s ease; backdrop-filter: blur(10px);"' +
            ' onmouseover="this.style.background=\'rgba(255, 255, 255, 0.3)\';"' +
            ' onmouseout="this.style.background=\'rgba(255, 255, 255, 0.2)\';">←</button>' +
            '<div style="text-align: left; max-width: 600px; position: relative; z-index: 5;">' +
                '<h1 style="font-size: 56px; font-weight: 900; color: #fff; margin: 0 0 8px 0; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">' + driverName + '</h1>' +
                '<div style="font-size: 20px; font-weight: 600; margin-bottom: 20px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px;">' + teamName + '</div>' +
                '<div style="color: rgba(255,255,255,0.8); font-size: 18px; margin-bottom: 50px; font-weight: 500;">2025 Saison</div>' +
                '<div style="margin-bottom: 40px;">' +
                    '<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 30px;">' +
                        '<span style="font-size: 80px; font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">' + (position || '01').toString().padStart(2, '0') + '</span>' +
                        '<span style="font-size: 18px; color: rgba(255,255,255,0.8); text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">POS</span>' +
                    '</div>' +
                    '<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 40px;">' +
                        '<span style="font-size: 80px; font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">' + stats.points + '</span>' +
                        '<span style="font-size: 18px; color: rgba(255,255,255,0.8); text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">PTS</span>' +
                    '</div>' +
                '</div>' +
                '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 30px;">' +
                    '<span style="font-size: 24px;"></span>' +
                    '<span style="font-size: 32px; font-weight: 900; color: #fff; margin-right: 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">' + stats.wins + '</span>' +
                    '<span style="font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">Victoires</span>' +
                '</div>' +
                '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 30px;">' +
                    '<span style="font-size: 24px;"></span>' +
                    '<span style="font-size: 32px; font-weight: 900; color: #fff; margin-right: 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">' + stats.podiums + '</span>' +
                    '<span style="font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">Podiums</span>' +
                '</div>' +
                '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 30px;">' +
                    '<span style="font-size: 24px;"></span>' +
                    '<span style="font-size: 32px; font-weight: 900; color: #fff; margin-right: 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">' + stats.poles + '</span>' +
                    '<span style="font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">Pôles</span>' +
                '</div>' +
            '</div>' +
        '</div>';

    modal.classList.add('active', 'fade-in');
};

window.showTeamDetails = function(teamId, teamName, stats, teamColor, position) {
    let modal = document.getElementById('driverDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'driverDetailsModal';
        modal.className = 'driver-details-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML =
        '<div class="driver-details-header" style="background: linear-gradient(135deg, ' + teamColor + ' 0%, ' + teamColor + '80 50%, ' + teamColor + '60 100%); padding: 60px 40px 40px; position: relative; min-height: 100vh; overflow: hidden;">' +
            '<button class="driver-details-close" onclick="closeDriverDetails()" style="position: absolute; top: 30px; left: 30px; background: rgba(255, 255, 255, 0.2); border: none; color: #fff; font-size: 20px; width: 50px; height: 50px; border-radius: 25px; cursor: pointer; z-index: 10; transition: all 0.3s ease; backdrop-filter: blur(10px);"' +
            ' onmouseover="this.style.background=\'rgba(255, 255, 255, 0.3)\';"' +
            ' onmouseout="this.style.background=\'rgba(255, 255, 255, 0.2)\';">←</button>' +
            '<div style="text-align: left; max-width: 600px; position: relative; z-index: 5;">' +
                '<h1 style="font-size: 56px; font-weight: 900; color: #fff; margin: 0 0 8px 0; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">' + teamName + '</h1>' +
                '<div style="color: rgba(255,255,255,0.8); font-size: 18px; margin-bottom: 50px; font-weight: 500;">2025 Saison</div>' +
                '<div style="margin-bottom: 40px;">' +
                    '<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 30px;">' +
                        '<span style="font-size: 80px; font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">' + (position || '01').toString().padStart(2, '0') + '</span>' +
                        '<span style="font-size: 18px; color: rgba(255,255,255,0.8); text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">POS</span>' +
                    '</div>' +
                    '<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 40px;">' +
                        '<span style="font-size: 80px; font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">' + stats.points + '</span>' +
                        '<span style="font-size: 18px; color: rgba(255,255,255,0.8); text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">PTS</span>' +
                    '</div>' +
                '</div>' +
                '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 30px;">' +
                    '<span style="font-size: 24px;"></span>' +
                    '<span style="font-size: 32px; font-weight: 900; color: #fff; margin-right: 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">' + stats.wins + '</span>' +
                    '<span style="font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">Victoires</span>' +
                '</div>' +
                '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 30px;">' +
                    '<span style="font-size: 24px;"></span>' +
                    '<span style="font-size: 32px; font-weight: 900; color: #fff; margin-right: 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">' + stats.podiums + '</span>' +
                    '<span style="font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">Podiums</span>' +
                '</div>' +
                '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 30px;">' +
                    '<span style="font-size: 24px;"></span>' +
                    '<span style="font-size: 32px; font-weight: 900; color: #fff; margin-right: 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">' + stats.poles + '</span>' +
                    '<span style="font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">Pôles</span>' +
                '</div>' +
            '</div>' +
        '</div>';

    modal.classList.add('active', 'fade-in');
};

window.closeDriverDetails = function() {
    const modal = document.getElementById('driverDetailsModal');
    if (modal) {
        modal.classList.remove('active');
    }
};

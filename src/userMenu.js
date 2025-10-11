import { Onboarding } from "@/onboarding.js";

export class UserMenu {
    constructor() {
        this.isVisible = false;
        this.user = Onboarding.getUser();
        this.menuContainer = null;
        this.overlay = null;
        this.setupUserMenu();
        this.setupEventListeners();
    }

    setupUserMenu() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-40 hidden';
        this.overlay.onclick = () => this.hide();

        // Create menu container
        this.menuContainer = document.createElement('div');
        this.menuContainer.className = 'fixed top-4 right-4 bg-gray-900 bg-opacity-90 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl z-50 hidden';
        this.menuContainer.style.minWidth = '300px';

        this.renderMenu();

        // Append to body
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.menuContainer);

        // Create user button in top corner
        this.createUserButton();
    }

    createUserButton() {
        // Remove existing button if any
        const existingBtn = document.getElementById('user-menu-btn');
        if (existingBtn) existingBtn.remove();

        const userButton = document.createElement('button');
        userButton.id = 'user-menu-btn';
        userButton.className = 'fixed top-4 right-4 z-30 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-colors duration-200 flex items-center space-x-2';
        
        if (this.user) {
            userButton.innerHTML = `
                <img src="${this.user.picture || 'assets/images/player_head/player_head_0.png'}" 
                     alt="Profile" 
                     class="w-8 h-8 rounded-full border-2 border-white">
                <span class="hidden sm:block text-sm font-medium">${this.user.name || 'User'}</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            `;
        } else {
            userButton.innerHTML = `
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                <span class="hidden sm:block text-sm font-medium">Profile</span>
            `;
        }

        userButton.onclick = () => this.toggle();
        document.body.appendChild(userButton);
    }

    renderMenu() {
        if (!this.user) {
            this.menuContainer.innerHTML = `
                <div class="p-4 text-center">
                    <p class="text-gray-300 mb-4">Not logged in</p>
                    <button onclick="window.location.href='landing.html'" 
                            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors">
                        Login
                    </button>
                </div>
            `;
            return;
        }

        this.menuContainer.innerHTML = `
            <div class="p-4">
                <!-- User Profile Header -->
                <div class="flex items-center space-x-3 mb-4 pb-4 border-b border-gray-700">
                    <img src="${this.user.picture || 'assets/images/player_head/player_head_0.png'}" 
                         alt="Profile Picture" 
                         class="w-12 h-12 rounded-full border-2 border-blue-500">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-white font-semibold truncate">${this.user.name || 'Unknown User'}</h3>
                        <p class="text-gray-400 text-sm truncate">${this.user.email || ''}</p>
                    </div>
                    <div class="flex-shrink-0">
                        <div class="w-3 h-3 bg-green-400 rounded-full" title="Online"></div>
                    </div>
                </div>

                <!-- Game Stats -->
                <div class="mb-4 pb-4 border-b border-gray-700">
                    <h4 class="text-gray-300 text-sm font-medium mb-2">Game Stats</h4>
                    <div class="grid grid-cols-2 gap-3 text-center">
                        <div class="bg-gray-800 bg-opacity-50 rounded p-2">
                            <div class="text-blue-400 font-bold" id="games-played">0</div>
                            <div class="text-gray-400 text-xs">Games</div>
                        </div>
                        <div class="bg-gray-800 bg-opacity-50 rounded p-2">
                            <div class="text-green-400 font-bold" id="wins">0</div>
                            <div class="text-gray-400 text-xs">Wins</div>
                        </div>
                    </div>
                </div>

                <!-- Menu Options -->
                <div class="space-y-2">
                    <button onclick="userMenu.showProfile()" 
                            class="w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded transition-colors flex items-center space-x-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                        <span>View Profile</span>
                    </button>

                    <button onclick="userMenu.showSettings()" 
                            class="w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded transition-colors flex items-center space-x-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <span>Settings</span>
                    </button>

                    <button onclick="userMenu.redoOnboarding()" 
                            class="w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded transition-colors flex items-center space-x-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>
                        <span>Tutorial</span>
                    </button>

                    <div class="border-t border-gray-700 pt-2">
                        <button onclick="userMenu.logout()" 
                                class="w-full text-left px-3 py-2 text-red-400 hover:bg-red-900 hover:bg-opacity-30 rounded transition-colors flex items-center space-x-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                            </svg>
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Update stats if available
        this.updateStats();
    }

    setupEventListeners() {
        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            if (this.isVisible && 
                !this.menuContainer.contains(event.target) && 
                !document.getElementById('user-menu-btn').contains(event.target)) {
                this.hide();
            }
        });

        // Close menu on escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show() {
        this.isVisible = true;
        this.overlay.classList.remove('hidden');
        this.menuContainer.classList.remove('hidden');
        
        // Add show animation
        this.menuContainer.style.transform = 'translateY(-10px)';
        this.menuContainer.style.opacity = '0';
        
        requestAnimationFrame(() => {
            this.menuContainer.style.transition = 'all 0.2s ease-out';
            this.menuContainer.style.transform = 'translateY(0)';
            this.menuContainer.style.opacity = '1';
        });
    }

    hide() {
        this.isVisible = false;
        
        // Add hide animation
        this.menuContainer.style.transform = 'translateY(-10px)';
        this.menuContainer.style.opacity = '0';
        
        setTimeout(() => {
            this.overlay.classList.add('hidden');
            this.menuContainer.classList.add('hidden');
        }, 200);
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    showProfile() {
        this.hide();
        
        // Create profile modal
        const profileModal = document.createElement('div');
        profileModal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60';
        profileModal.innerHTML = `
            <div class="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
                <div class="text-center mb-6">
                    <img src="${this.user.picture || 'assets/images/player_head/player_head_0.png'}" 
                         alt="Profile Picture" 
                         class="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-blue-500">
                    <h2 class="text-2xl font-bold text-white">${this.user.name || 'Unknown User'}</h2>
                    <p class="text-gray-400">${this.user.email || ''}</p>
                </div>
                
                <div class="bg-gray-800 bg-opacity-50 rounded-lg p-4 mb-6">
                    <h3 class="text-white font-semibold mb-3">Account Details</h3>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">User ID:</span>
                            <span class="text-gray-300">${this.user.sub || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Joined:</span>
                            <span class="text-gray-300">${new Date().toLocaleDateString()}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-400">Status:</span>
                            <span class="text-green-400">Active</span>
                        </div>
                    </div>
                </div>
                
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(profileModal);
        
        // Auto-remove on click outside
        profileModal.onclick = (event) => {
            if (event.target === profileModal) {
                profileModal.remove();
            }
        };
    }

    showSettings() {
        this.hide();
        
        // Create settings modal
        const settingsModal = document.createElement('div');
        settingsModal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60';
        settingsModal.innerHTML = `
            <div class="bg-gray-900 rounded-lg p-6 max-w-lg w-full mx-4 border border-gray-700">
                <h2 class="text-2xl font-bold text-white mb-6">Game Settings</h2>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-gray-300 text-sm font-medium mb-2">Master Volume</label>
                        <input type="range" min="0" max="100" value="50" 
                               class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                    </div>
                    
                    <div>
                        <label class="block text-gray-300 text-sm font-medium mb-2">SFX Volume</label>
                        <input type="range" min="0" max="100" value="75" 
                               class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                    </div>
                    
                    <div>
                        <label class="block text-gray-300 text-sm font-medium mb-2">Graphics Quality</label>
                        <select class="w-full bg-gray-800 border border-gray-700 text-white rounded px-3 py-2">
                            <option>High</option>
                            <option>Medium</option>
                            <option>Low</option>
                        </select>
                    </div>
                    
                    <div class="flex items-center">
                        <input type="checkbox" id="fullscreen" class="mr-2">
                        <label for="fullscreen" class="text-gray-300">Enable Fullscreen</label>
                    </div>
                    
                    <div class="flex items-center">
                        <input type="checkbox" id="vsync" class="mr-2" checked>
                        <label for="vsync" class="text-gray-300">Vertical Sync</label>
                    </div>
                </div>
                
                <div class="flex space-x-3 mt-6">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors">
                        Cancel
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors">
                        Save
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(settingsModal);
        
        // Auto-remove on click outside
        settingsModal.onclick = (event) => {
            if (event.target === settingsModal) {
                settingsModal.remove();
            }
        };
    }

    redoOnboarding() {
        this.hide();
        
        // Clear onboarding status and redirect
        localStorage.removeItem('smartCampusOnboardingCompleted');
        window.location.href = 'index.html?state=onboarding';
    }

    logout() {
        this.hide();
        
        // Confirm logout
        const confirmModal = document.createElement('div');
        confirmModal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60';
        confirmModal.innerHTML = `
            <div class="bg-gray-900 rounded-lg p-6 max-w-sm w-full mx-4 border border-gray-700 text-center">
                <h3 class="text-xl font-bold text-white mb-4">Confirm Logout</h3>
                <p class="text-gray-300 mb-6">Are you sure you want to logout? Your progress will be saved.</p>
                
                <div class="flex space-x-3">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors">
                        Cancel
                    </button>
                    <button onclick="userMenu.confirmLogout()" 
                            class="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition-colors">
                        Logout
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
        
        // Auto-remove on click outside
        confirmModal.onclick = (event) => {
            if (event.target === confirmModal) {
                confirmModal.remove();
            }
        };
    }

    confirmLogout() {
        // Clear user data
        localStorage.removeItem('smartCampusUser');
        localStorage.removeItem('smartCampusOnboardingCompleted');
        
        // Redirect to landing page
        window.location.href = 'landing.html';
    }

    updateStats() {
        // Get stats from localStorage or API
        const stats = this.getPlayerStats();
        
        const gamesPlayedEl = document.getElementById('games-played');
        const winsEl = document.getElementById('wins');
        
        if (gamesPlayedEl) gamesPlayedEl.textContent = stats.gamesPlayed;
        if (winsEl) winsEl.textContent = stats.wins;
    }

    getPlayerStats() {
        // Get stats from localStorage or return defaults
        const stats = localStorage.getItem('smartCampusStats');
        if (stats) {
            try {
                return JSON.parse(stats);
            } catch (e) {
                console.warn('Invalid stats data in localStorage');
            }
        }
        
        return {
            gamesPlayed: 0,
            wins: 0,
            totalKills: 0,
            averageScore: 0
        };
    }

    incrementStat(statName, value = 1) {
        const stats = this.getPlayerStats();
        stats[statName] = (stats[statName] || 0) + value;
        localStorage.setItem('smartCampusStats', JSON.stringify(stats));
        this.updateStats();
    }

    destroy() {
        // Clean up event listeners and DOM elements
        if (this.overlay) this.overlay.remove();
        if (this.menuContainer) this.menuContainer.remove();
        
        const userButton = document.getElementById('user-menu-btn');
        if (userButton) userButton.remove();
    }
}

// Create global instance
let userMenu = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (Onboarding.isLoggedIn()) {
        userMenu = new UserMenu();
        window.userMenu = userMenu; // Make globally accessible
    }
});

// Export for module usage
export { userMenu };
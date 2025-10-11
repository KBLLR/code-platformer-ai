import { loadGameConfig } from "@/game_config.js";
import { LoaderManager } from "@/LoaderManager.js";

export class Onboarding {
    constructor() {
        this.currentStep = 0;
        this.steps = [
            'welcome',
            'controls',
            'weapons',
            'objectives',
            'ready'
        ];
        this.onboardingContainer = null;
        this.user = this.getUserFromStorage();
        this.setupOnboardingContainer();
    }

    getUserFromStorage() {
        try {
            const userData = localStorage.getItem('smartCampusUser');
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Error reading user data:', error);
            return null;
        }
    }

    setupOnboardingContainer() {
        // Create onboarding container if it doesn't exist
        this.onboardingContainer = document.createElement('div');
        this.onboardingContainer.id = 'onboarding-container';
        this.onboardingContainer.className = 'fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50';
        this.onboardingContainer.style.display = 'none';
        document.body.appendChild(this.onboardingContainer);
    }

    async Show() {
        console.log('[Onboarding] Starting onboarding flow');
        
        // Load game config if needed
        await loadGameConfig();
        
        // Hide other UI elements
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) {
            uiContainer.style.display = 'none';
        }

        // Show onboarding container
        this.onboardingContainer.style.display = 'flex';
        
        // Start with first step
        this.showStep(0);
    }

    Hide() {
        this.onboardingContainer.style.display = 'none';
        
        // Show game UI again
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) {
            uiContainer.style.display = 'block';
        }
    }

    showStep(stepIndex) {
        this.currentStep = stepIndex;
        const stepName = this.steps[stepIndex];
        
        this.onboardingContainer.innerHTML = '';
        
        switch (stepName) {
            case 'welcome':
                this.showWelcomeStep();
                break;
            case 'controls':
                this.showControlsStep();
                break;
            case 'weapons':
                this.showWeaponsStep();
                break;
            case 'objectives':
                this.showObjectivesStep();
                break;
            case 'ready':
                this.showReadyStep();
                break;
        }
    }

    showWelcomeStep() {
        const userName = this.user?.name || 'Player';
        
        this.onboardingContainer.innerHTML = `
            <div class="max-w-2xl mx-auto text-center p-8 bg-gray-900 bg-opacity-80 rounded-2xl backdrop-blur-sm border border-gray-700">
                <div class="mb-6">
                    <img src="${this.user?.picture || 'assets/images/player_head/player_head_0.png'}" 
                         alt="Profile" 
                         class="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-blue-500">
                    <h1 class="text-4xl font-bold text-white mb-2">Welcome, ${userName}!</h1>
                    <p class="text-xl text-gray-300">Ready to join the SMART CAMPUS Arena?</p>
                </div>
                
                <div class="mb-8">
                    <div class="bg-blue-900 bg-opacity-50 rounded-lg p-6 mb-6">
                        <h2 class="text-2xl font-semibold text-blue-300 mb-3">What is SMART CAMPUS?</h2>
                        <p class="text-gray-300 leading-relaxed">
                            A revolutionary multiplayer battle arena where CODE students compete in fast-paced 2.5D combat. 
                            Master various weapons, dominate different arenas, and prove your skills against fellow students!
                        </p>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div class="bg-green-900 bg-opacity-50 rounded-lg p-4">
                            <div class="text-3xl mb-2">⚔️</div>
                            <p class="text-green-300 font-semibold">Epic Combat</p>
                        </div>
                        <div class="bg-purple-900 bg-opacity-50 rounded-lg p-4">
                            <div class="text-3xl mb-2">🏆</div>
                            <p class="text-purple-300 font-semibold">Compete & Win</p>
                        </div>
                        <div class="bg-orange-900 bg-opacity-50 rounded-lg p-4">
                            <div class="text-3xl mb-2">🎮</div>
                            <p class="text-orange-300 font-semibold">Multiple Arenas</p>
                        </div>
                    </div>
                </div>
                
                <button onclick="onboarding.nextStep()" 
                        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 text-lg">
                    Let's Get Started! →
                </button>
            </div>
        `;
    }

    showControlsStep() {
        this.onboardingContainer.innerHTML = `
            <div class="max-w-4xl mx-auto p-8 bg-gray-900 bg-opacity-80 rounded-2xl backdrop-blur-sm border border-gray-700">
                <h1 class="text-4xl font-bold text-white text-center mb-8">Master the Controls</h1>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div class="bg-gray-800 bg-opacity-50 rounded-lg p-6">
                        <h2 class="text-2xl font-semibold text-yellow-400 mb-4">Movement</h2>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-gray-300">Move Left</span>
                                <kbd class="bg-gray-700 px-3 py-1 rounded text-white">A</kbd>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-gray-300">Move Right</span>
                                <kbd class="bg-gray-700 px-3 py-1 rounded text-white">D</kbd>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-gray-300">Jump</span>
                                <kbd class="bg-gray-700 px-3 py-1 rounded text-white">W</kbd>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-gray-300">Crouch</span>
                                <kbd class="bg-gray-700 px-3 py-1 rounded text-white">S</kbd>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-800 bg-opacity-50 rounded-lg p-6">
                        <h2 class="text-2xl font-semibold text-red-400 mb-4">Combat</h2>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-gray-300">Fire Weapon</span>
                                <kbd class="bg-gray-700 px-3 py-1 rounded text-white">Space</kbd>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-gray-300">Aim Up</span>
                                <kbd class="bg-gray-700 px-3 py-1 rounded text-white">↑</kbd>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-gray-300">Aim Down</span>
                                <kbd class="bg-gray-700 px-3 py-1 rounded text-white">↓</kbd>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-gray-300">Pick Up Weapon</span>
                                <kbd class="bg-gray-700 px-3 py-1 rounded text-white">E</kbd>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="bg-blue-900 bg-opacity-50 rounded-lg p-6 mb-8">
                    <h3 class="text-xl font-semibold text-blue-300 mb-3">💡 Pro Tips</h3>
                    <ul class="text-gray-300 space-y-2">
                        <li>• Use jump and crouch to dodge enemy fire</li>
                        <li>• Pick up new weapons from mystery boxes</li>
                        <li>• Control your aim direction with arrow keys</li>
                        <li>• Stay mobile - standing still makes you an easy target!</li>
                    </ul>
                </div>
                
                <div class="flex justify-center space-x-4">
                    <button onclick="onboarding.prevStep()" 
                            class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200">
                        ← Back
                    </button>
                    <button onclick="onboarding.nextStep()" 
                            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200">
                        Got It! →
                    </button>
                </div>
            </div>
        `;
    }

    showWeaponsStep() {
        this.onboardingContainer.innerHTML = `
            <div class="max-w-5xl mx-auto p-8 bg-gray-900 bg-opacity-80 rounded-2xl backdrop-blur-sm border border-gray-700">
                <h1 class="text-4xl font-bold text-white text-center mb-8">Arsenal & Weapons</h1>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div class="bg-gradient-to-b from-green-900 to-green-800 bg-opacity-50 rounded-lg p-6 text-center">
                        <div class="text-5xl mb-3">🏹</div>
                        <h3 class="text-xl font-semibold text-green-300 mb-2">Bow</h3>
                        <p class="text-gray-300 text-sm mb-3">Silent and precise</p>
                        <div class="text-xs text-gray-400">
                            <div>Damage: ⭐⭐⭐</div>
                            <div>Speed: ⭐⭐</div>
                            <div>Range: ⭐⭐⭐⭐</div>
                        </div>
                    </div>
                    
                    <div class="bg-gradient-to-b from-blue-900 to-blue-800 bg-opacity-50 rounded-lg p-6 text-center">
                        <div class="text-5xl mb-3">🔫</div>
                        <h3 class="text-xl font-semibold text-blue-300 mb-2">Pistol</h3>
                        <p class="text-gray-300 text-sm mb-3">Balanced and reliable</p>
                        <div class="text-xs text-gray-400">
                            <div>Damage: ⭐⭐</div>
                            <div>Speed: ⭐⭐⭐</div>
                            <div>Range: ⭐⭐⭐</div>
                        </div>
                    </div>
                    
                    <div class="bg-gradient-to-b from-red-900 to-red-800 bg-opacity-50 rounded-lg p-6 text-center">
                        <div class="text-5xl mb-3">💥</div>
                        <h3 class="text-xl font-semibold text-red-300 mb-2">Shotgun</h3>
                        <p class="text-gray-300 text-sm mb-3">Close-range devastation</p>
                        <div class="text-xs text-gray-400">
                            <div>Damage: ⭐⭐⭐⭐</div>
                            <div>Speed: ⭐</div>
                            <div>Range: ⭐⭐</div>
                        </div>
                    </div>
                    
                    <div class="bg-gradient-to-b from-purple-900 to-purple-800 bg-opacity-50 rounded-lg p-6 text-center">
                        <div class="text-5xl mb-3">⚡</div>
                        <h3 class="text-xl font-semibold text-purple-300 mb-2">Minigun</h3>
                        <p class="text-gray-300 text-sm mb-3">Rapid-fire mayhem</p>
                        <div class="text-xs text-gray-400">
                            <div>Damage: ⭐⭐</div>
                            <div>Speed: ⭐⭐⭐⭐⭐</div>
                            <div>Range: ⭐⭐⭐</div>
                        </div>
                    </div>
                </div>
                
                <div class="bg-yellow-900 bg-opacity-50 rounded-lg p-6 mb-8">
                    <h3 class="text-xl font-semibold text-yellow-300 mb-3">🎁 Weapon Spawns</h3>
                    <p class="text-gray-300 mb-3">Look for mystery boxes throughout the arena! They contain powerful weapons that can turn the tide of battle.</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-yellow-400">• Spawn every 15 seconds</span><br>
                            <span class="text-gray-300">Keep an eye on spawn timers</span>
                        </div>
                        <div>
                            <span class="text-yellow-400">• Limited ammo</span><br>
                            <span class="text-gray-300">Make every shot count!</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-center space-x-4">
                    <button onclick="onboarding.prevStep()" 
                            class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200">
                        ← Back
                    </button>
                    <button onclick="onboarding.nextStep()" 
                            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200">
                        Next →
                    </button>
                </div>
            </div>
        `;
    }

    showObjectivesStep() {
        this.onboardingContainer.innerHTML = `
            <div class="max-w-4xl mx-auto p-8 bg-gray-900 bg-opacity-80 rounded-2xl backdrop-blur-sm border border-gray-700">
                <h1 class="text-4xl font-bold text-white text-center mb-8">Game Objectives</h1>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div class="bg-gradient-to-br from-red-900 to-orange-900 bg-opacity-50 rounded-lg p-6">
                        <h2 class="text-2xl font-semibold text-orange-300 mb-4">🎯 Battle Royale</h2>
                        <p class="text-gray-300 mb-4">Eliminate all other players to claim victory!</p>
                        <ul class="text-gray-400 space-y-2 text-sm">
                            <li>• Last player standing wins</li>
                            <li>• Use the environment to your advantage</li>
                            <li>• Collect better weapons to dominate</li>
                            <li>• Stay in the safe zone</li>
                        </ul>
                    </div>
                    
                    <div class="bg-gradient-to-br from-blue-900 to-purple-900 bg-opacity-50 rounded-lg p-6">
                        <h2 class="text-2xl font-semibold text-purple-300 mb-4">🏆 Scoring System</h2>
                        <p class="text-gray-300 mb-4">Earn points through skillful play!</p>
                        <ul class="text-gray-400 space-y-2 text-sm">
                            <li>• <span class="text-green-400">+100</span> Elimination</li>
                            <li>• <span class="text-blue-400">+50</span> Weapon pickup</li>
                            <li>• <span class="text-yellow-400">+25</span> Survival time</li>
                            <li>• <span class="text-purple-400">+200</span> Victory bonus</li>
                        </ul>
                    </div>
                </div>
                
                <div class="bg-green-900 bg-opacity-50 rounded-lg p-6 mb-8">
                    <h3 class="text-xl font-semibold text-green-300 mb-3">🌍 Arena Environments</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                        <div>
                            <div class="text-2xl mb-1">🏢</div>
                            <span class="text-gray-300">Google Campus</span>
                        </div>
                        <div>
                            <div class="text-2xl mb-1">💻</div>
                            <span class="text-gray-300">Code Lab</span>
                        </div>
                        <div>
                            <div class="text-2xl mb-1">🏠</div>
                            <span class="text-gray-300">Basement</span>
                        </div>
                        <div>
                            <div class="text-2xl mb-1">🎱</div>
                            <span class="text-gray-300">Ball Pit</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-blue-900 bg-opacity-50 rounded-lg p-6 mb-8">
                    <h3 class="text-xl font-semibold text-blue-300 mb-3">🎮 Game Modes</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 class="text-green-400 font-semibold mb-2">Solo Play</h4>
                            <p class="text-gray-300 text-sm">Practice against AI opponents</p>
                        </div>
                        <div>
                            <h4 class="text-purple-400 font-semibold mb-2">Multiplayer</h4>
                            <p class="text-gray-300 text-sm">Compete with fellow students</p>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-center space-x-4">
                    <button onclick="onboarding.prevStep()" 
                            class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200">
                        ← Back
                    </button>
                    <button onclick="onboarding.nextStep()" 
                            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200">
                        Almost Done! →
                    </button>
                </div>
            </div>
        `;
    }

    showReadyStep() {
        this.onboardingContainer.innerHTML = `
            <div class="max-w-3xl mx-auto text-center p-8 bg-gray-900 bg-opacity-80 rounded-2xl backdrop-blur-sm border border-gray-700">
                <div class="mb-6">
                    <div class="text-6xl mb-4">🚀</div>
                    <h1 class="text-4xl font-bold text-white mb-4">You're Ready to Battle!</h1>
                    <p class="text-xl text-gray-300 mb-8">Welcome to the SMART CAMPUS Arena, ${this.user?.name || 'Player'}!</p>
                </div>
                
                <div class="bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-50 rounded-lg p-6 mb-8">
                    <h2 class="text-2xl font-semibold text-white mb-4">Quick Recap</h2>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div class="text-center">
                            <div class="text-2xl mb-2">⌨️</div>
                            <p class="text-gray-300">WASD + Arrows</p>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl mb-2">🔫</div>
                            <p class="text-gray-300">Collect Weapons</p>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl mb-2">🎯</div>
                            <p class="text-gray-300">Eliminate Enemies</p>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl mb-2">🏆</div>
                            <p class="text-gray-300">Be Last Standing</p>
                        </div>
                    </div>
                </div>
                
                <div class="mb-8">
                    <p class="text-gray-400 mb-4">Choose your starting preference:</p>
                    <div class="flex justify-center space-x-4 mb-6">
                        <label class="flex items-center space-x-2 text-gray-300 cursor-pointer">
                            <input type="radio" name="startMode" value="practice" checked class="text-blue-600">
                            <span>Practice vs AI</span>
                        </label>
                        <label class="flex items-center space-x-2 text-gray-300 cursor-pointer">
                            <input type="radio" name="startMode" value="multiplayer" class="text-blue-600">
                            <span>Jump into Multiplayer</span>
                        </label>
                    </div>
                </div>
                
                <div class="flex justify-center space-x-4">
                    <button onclick="onboarding.prevStep()" 
                            class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200">
                        ← Back
                    </button>
                    <button onclick="onboarding.completeOnboarding()" 
                            class="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-200 transform hover:scale-105">
                        Enter Arena! 🎮
                    </button>
                </div>
            </div>
        `;
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    completeOnboarding() {
        // Mark onboarding as completed
        localStorage.setItem('smartCampusOnboardingCompleted', 'true');
        
        // Get selected start mode
        const startMode = document.querySelector('input[name="startMode"]:checked')?.value || 'practice';
        
        console.log('[Onboarding] Completed with mode:', startMode);
        
        // Hide onboarding
        this.Hide();
        
        // Trigger completion callback if provided
        if (this.onComplete) {
            this.onComplete(startMode);
        }
    }

    OnComplete(callback) {
        this.onComplete = callback;
    }

    static hasCompletedOnboarding() {
        return localStorage.getItem('smartCampusOnboardingCompleted') === 'true';
    }

    static isLoggedIn() {
        return localStorage.getItem('smartCampusUser') !== null;
    }

    static getUser() {
        try {
            const userData = localStorage.getItem('smartCampusUser');
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Error reading user data:', error);
            return null;
        }
    }
}

// Make onboarding globally accessible for button clicks
window.onboarding = null;

// Initialize onboarding when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in onboarding mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('state') === 'onboarding') {
        window.onboarding = new Onboarding();
        window.onboarding.Show();
    }
});
// src/sounds.js
import { LoaderManager } from "@/LoaderManager.js";

class Sounds {
  // Static instance of LoaderManager to load audio assets
  static loader = new LoaderManager();

  // Object to store loaded HTMLAudioElement instances, keyed by sound label
  static sounds = {};

  /**
   * Loads all sound assets defined in the manifest.
   * This should be called once at game initialization.
   * @param {Function} on_done - Callback function to execute once all sounds are loaded.
   */
  static async LoadSounds(on_done) {
    try {
      // Ensure the manifest is loaded
      await Sounds.loader.loadManifest();

      const soundEntries = Sounds.loader.manifest.sounds;
      if (!soundEntries || soundEntries.length === 0) {
        console.warn("No sound entries found in manifest.sounds.");
        on_done(); // Call done even if no sounds
        return;
      }

      const loadPromises = [];
      for (const entry of soundEntries) {
        if (entry.label) {
          // Use the sound's label as the key for playback (e.g., Sounds.Play('Bow'))
          // The LoaderManager.loadSound handles caching.
          const loadPromise = Sounds.loader
            .loadSound(entry.label)
            .then((audio) => {
              Sounds.sounds[entry.label] = audio;
              if (process.env.NODE_ENV === "development") {
                console.log(`Loaded sound: ${entry.label} (${entry.file})`);
              }
            })
            .catch((error) => {
              console.error(
                `Failed to load sound '${entry.label}' (${entry.file}):`,
                error,
              );
              // Store a dummy object or null to prevent future errors if sound fails
              Sounds.sounds[entry.label] = null;
            });
          loadPromises.push(loadPromise);
        } else {
          console.warn(`Sound entry missing label: ${JSON.stringify(entry)}`);
        }
      }

      // Wait for all sounds to load
      await Promise.all(loadPromises);

      if (process.env.NODE_ENV === "development") {
        console.log(
          "All sounds loaded. Available sounds:",
          Object.keys(Sounds.sounds),
        );
      }
      on_done();
    } catch (error) {
      console.error("Error loading sounds manifest or assets:", error);
      on_done(); // Ensure callback is called even on error
    }
  }

  /**
   * Plays a loaded sound.
   * @param {string} soundName - The name (label) of the sound to play (e.g., 'Bow', 'Shotgun').
   * @param {object} [options] - Optional playback options (e.g., { volume: 0.5, loop: false }).
   */
  static Play(soundName, options) {
    const audio = Sounds.sounds[soundName];
    if (audio instanceof HTMLAudioElement) {
      // Create a clone for SFX to allow overlapping playback
      // For music, you might want to play the original directly or manage it separately.
      if (options && options.type === "music") {
        // For music, you usually want to manage a single instance
        // Set volume/loop on the main audio object
        if (options.volume !== undefined) audio.volume = options.volume;
        if (options.loop !== undefined) audio.loop = options.loop;
        audio
          .play()
          .catch((e) =>
            console.warn(`Failed to play music '${soundName}':`, e),
          );
      } else {
        // For SFX, create a new instance to allow multiple simultaneous plays
        const sfxInstance = audio.cloneNode();
        if (options && options.volume !== undefined)
          sfxInstance.volume = options.volume;
        sfxInstance
          .play()
          .catch((e) => console.warn(`Failed to play sfx '${soundName}':`, e));
        // Optionally, dispose of the sfxInstance after it plays to prevent memory leaks
        sfxInstance.onended = () => sfxInstance.remove();
      }
    } else {
      console.warn(`Sound '${soundName}' not found or not loaded correctly.`);
    }
  }
}

export { Sounds };

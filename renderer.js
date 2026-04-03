let sounds = [];
let nextId = 1;
const audioElements = new Map();

document.addEventListener('DOMContentLoaded', async () => {
  await populateAudioDevices();
  
  document.getElementById('add-sound-btn').addEventListener('click', addSound);
  document.getElementById('audio-output').addEventListener('change', updateAllSinks);

  // Modal logic
  document.getElementById('show-qr-btn').addEventListener('click', async () => {
    const modal = document.getElementById('qr-modal');
    modal.style.display = 'flex';
    const qrData = await window.electronAPI.getQR();
    if (qrData) {
      document.getElementById('qr-code-img').src = qrData;
    }
  });

  document.getElementById('close-qr-btn').addEventListener('click', () => {
    document.getElementById('qr-modal').style.display = 'none';
  });

  // Drag and Drop logic
  const overlay = document.getElementById('drop-overlay');
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay.style.display = 'flex';
  });
  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay.style.display = 'none';
  });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay.style.display = 'none';
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (const file of e.dataTransfer.files) {
        if (file.path.match(/\.(mp3|wav|ogg)$/i)) {
          await addSoundByPath(file.path);
        }
      }
    }
  });

  // Listen for play commands from main process
  window.electronAPI.onPlaySound((id) => {
    playSoundById(id);
  });
  
  window.electronAPI.onStopAll(() => {
    stopAllSounds();
  });

  // Local escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      stopAllSounds();
    }
  });

  document.getElementById('stop-all-btn').addEventListener('click', stopAllSounds);

  await loadSavedSounds();
});

function stopAllSounds() {
  audioElements.forEach(audios => {
    audios.local.pause();
    audios.local.currentTime = 0;
    audios.routed.pause();
    audios.routed.currentTime = 0;
  });
}

async function loadSavedSounds() {
  const saved = await window.electronAPI.loadConfig();
  if (saved && saved.length > 0) {
    sounds = saved;
    nextId = Math.max(...sounds.map(s => s.id)) + 1;
    
    // Re-initialize audio elements and shortcuts
    for (const sound of sounds) {
      const audioLocal = new Audio(`file://${sound.filePath}`);
      const audioRouted = new Audio(`file://${sound.filePath}`);
      
      const vol = sound.volume !== undefined ? sound.volume : 1.0;
      audioLocal.volume = vol;
      audioRouted.volume = vol;
      
      audioElements.set(sound.id, { local: audioLocal, routed: audioRouted });
      
      if (sound.shortcut) {
        await window.electronAPI.registerShortcut({
          id: sound.id,
          shortcut: sound.shortcut,
          filePath: sound.filePath
        });
      }
    }
    
    updateAllSinks();
    renderSounds();
  }
}

async function populateAudioDevices() {
  try {
    // We request permissions in case the browser needs it to expose labels
    // In Electron with some setups it might not prompt and just work or may need navigator permissions tweak
    await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
        console.log('No microphone access (usually fine for output enumeration)', err);
    });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
    
    const select = document.getElementById('audio-output');
    select.innerHTML = '<option value="">Default OS Device</option>';
    
    audioOutputs.forEach(device => {
      // Avoid duplicate 'default' entries 
      if (device.deviceId === 'default' || device.deviceId === 'communications') return;
      
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Device ${device.deviceId.substring(0, 5)}...`;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error enumerating devices:', err);
  }
}

async function addSound() {
  const filePath = await window.electronAPI.openFile();
  if (filePath) {
    await addSoundByPath(filePath);
  }
}

async function addSoundByPath(filePath) {
  const filename = filePath.split('\\').pop().split('/').pop();
  
  const id = nextId++;
  
  // Create an audio element for local playback and another for routed playback
  const audioLocal = new Audio(`file://${filePath}`);
  const audioRouted = new Audio(`file://${filePath}`);
  
  // Set default volume
  audioLocal.volume = 1.0;
  audioRouted.volume = 1.0;
  
  audioElements.set(id, { local: audioLocal, routed: audioRouted });
  
  // Apply current sink only to the routed audio element
  applySinkToAudio(audioRouted);
  
  const soundConfig = {
    id,
    filePath,
    filename,
    shortcut: '',
    volume: 1.0
  };
  
  sounds.push(soundConfig);
  renderSounds();
  window.electronAPI.saveConfig(sounds);
}

function renderSounds() {
  const container = document.getElementById('sounds-list');
  container.innerHTML = '';
  
  sounds.forEach(sound => {
    const card = document.createElement('div');
    card.className = 'sound-card';
    card.id = `sound-card-${sound.id}`;
    
    card.innerHTML = `
      <div class="sound-info">
        <div class="sound-name">${sound.filename}</div>
        <button class="delete-btn" onclick="deleteSound(${sound.id})" title="Remove Sound">✖</button>
      </div>
      <div class="file-path" title="${sound.filePath}">${sound.filePath}</div>
      <div class="shortcut-group">
        <label>Volume</label>
        <input type="range" class="volume-slider" id="vol-${sound.id}" min="0" max="1" step="0.01" value="${sound.volume !== undefined ? sound.volume : 1.0}" />
      </div>
      <div class="shortcut-group">
        <label>Global Shortcut</label>
        <input type="text" class="shortcut-input" placeholder="Click here & press keys" 
          id="shortcut-input-${sound.id}" readonly value="${sound.shortcut}" />
      </div>

    `;
    
    container.appendChild(card);
    
    // Bind shortcut input
    const input = document.getElementById(`shortcut-input-${sound.id}`);
    input.addEventListener('keydown', (e) => handleShortcutInput(e, sound.id));
    
    // Bind volume slider
    const volInput = document.getElementById(`vol-${sound.id}`);
    volInput.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      sound.volume = vol;
      const audios = audioElements.get(sound.id);
      if (audios) {
        audios.local.volume = vol;
        audios.routed.volume = vol;
      }
    });
    
    // Save on release of drag
    volInput.addEventListener('change', () => {
      window.electronAPI.saveConfig(sounds);
    });
    

  });
}

async function handleShortcutInput(e, id) {
  e.preventDefault();
  
  // Ignore bare modifiers and system keys
  if (['Control', 'Shift', 'Alt', 'Meta', 'Tab', 'Escape'].includes(e.key)) return;
  
  if (e.key === 'Backspace' || e.key === 'Delete') {
    await clearShortcut(id);
    return;
  }

  const keys = [];
  if (e.ctrlKey) keys.push('CommandOrControl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  
  // Normalize key presentation for Electron globalShortcut
  let keyString = e.key;
  if (/^[a-z]$/.test(keyString)) {
    keyString = keyString.toUpperCase();
  } else if (keyString === ' ') {
    keyString = 'Space';
  } else if (keyString.startsWith('Arrow')) {
    keyString = keyString.replace('Arrow', ''); // Up, Down, Left, Right
  } else if (keyString === 'Enter') {
    keyString = 'Return';
  } else if (keyString === '+') {
    keyString = 'Plus';
  }
  
  keys.push(keyString);
  const shortcutString = keys.join('+');
  
  const sound = sounds.find(s => s.id === id);
  if (sound) {
    const input = document.getElementById(`shortcut-input-${id}`);
    
    // Clear existing shortcut before attempting to register new one
    await clearShortcut(id);
    
    input.value = shortcutString;
    sound.shortcut = shortcutString;
    
    // Register with main process
    const res = await window.electronAPI.registerShortcut({
      id: sound.id,
      shortcut: shortcutString,
      filePath: sound.filePath
    });
    
    if (!res.success) {
      alert(`Failed to register shortcut: ${res.error}. It might be in use by another app.`);
      input.value = '';
      sound.shortcut = '';
    }
    
    window.electronAPI.saveConfig(sounds);
  }
}

async function clearShortcut(id) {
  const sound = sounds.find(s => s.id === id);
  if (sound && sound.shortcut) {
    sound.shortcut = '';
    const input = document.getElementById(`shortcut-input-${id}`);
    if (input) input.value = '';
    await window.electronAPI.unregisterShortcut({ id });
    window.electronAPI.saveConfig(sounds);
  }
}

async function deleteSound(id) {
  await clearShortcut(id);
  sounds = sounds.filter(s => s.id !== id);
  
  const audios = audioElements.get(id);
  if (audios) {
    audios.local.pause();
    audios.routed.pause();
    audios.local.src = ''; 
    audios.routed.src = ''; 
    audioElements.delete(id);
  }
  
  renderSounds();
  window.electronAPI.saveConfig(sounds);
}

function playSoundById(id) {
  const audios = audioElements.get(id);
  if (!audios) return;
  
  const card = document.getElementById(`sound-card-${id}`);
  
  // Stop and rewind if already playing
  audios.local.pause();
  audios.local.currentTime = 0;
  audios.routed.pause();
  audios.routed.currentTime = 0;
  
  audios.local.play().catch(e => console.error("Local playback failed:", e));
  audios.routed.play().catch(e => console.error("Routed playback failed:", e));
  
  if (card) {
    card.classList.add('playing');
    audios.local.onended = () => {
      card.classList.remove('playing');
    };
  }
}

async function applySinkToAudio(audioElement) {
  const select = document.getElementById('audio-output');
  const deviceId = select.value;

  if (typeof audioElement.setSinkId === 'function') {
    try {
      await audioElement.setSinkId(deviceId);
    } catch (err) {
      console.error('Error setting sink ID. The browser might require interaction first.', err);
    }
  } else {
      console.warn("setSinkId is not supported in this Electron environment.");
  }
}

function updateAllSinks() {
  audioElements.forEach(audios => {
    applySinkToAudio(audios.routed);
  });
}

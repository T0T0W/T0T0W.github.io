const TMDB_KEY = 'd8b62990089ff760df22fac251ad7371'; // Ta clé
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

// État de l'application
let watchlist = [];
let ghToken = localStorage.getItem('gh_token') || '';
let gistId = localStorage.getItem('gist_id') || '';

// Éléments DOM
const searchInput = document.getElementById('search-input');
const resultsDiv = document.getElementById('search-results');
const myListDiv = document.getElementById('my-list');
const configModal = document.getElementById('config-modal');

// Initialisation
init();

function init() {
    // Vérifier si config présente
    if (!ghToken || !gistId) {
        configModal.classList.remove('hidden');
    } else {
        fetchWatchlist();
    }

    // Écouteur Recherche (avec petit délai pour éviter trop d'appels)
    let timeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => searchTMDB(e.target.value), 500);
    });

    // Boutons Config
    document.getElementById('btn-settings').addEventListener('click', () => configModal.classList.remove('hidden'));
    document.getElementById('close-config').addEventListener('click', () => configModal.classList.add('hidden'));
    document.getElementById('save-config').addEventListener('click', saveConfig);
}

// --- Fonctions TMDb ---

async function searchTMDB(query) {
    if (query.length < 2) {
        resultsDiv.classList.add('hidden');
        return;
    }

    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=fr-FR&query=${query}`);
        const data = await res.json();
        displaySearchResults(data.results);
    } catch (error) {
        console.error("Erreur TMDb", error);
    }
}

function displaySearchResults(items) {
    resultsDiv.innerHTML = '';
    const filtered = items.filter(i => i.media_type === 'movie' || i.media_type === 'tv');
    
    if (filtered.length === 0) return;

    filtered.forEach(item => {
        const card = createCard(item, false);
        resultsDiv.appendChild(card);
    });
    resultsDiv.classList.remove('hidden');
}

// --- Fonctions GitHub Gist ---

async function fetchWatchlist() {
    myListDiv.innerHTML = '<p>Chargement...</p>';
    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        const data = await res.json();
        
        // On suppose que le fichier s'appelle 'movies.json'
        const content = data.files['movies.json'] ? JSON.parse(data.files['movies.json'].content) : [];
        watchlist = content;
        renderWatchlist();
    } catch (e) {
        myListDiv.innerHTML = '<p>Erreur de chargement. Vérifie ta configuration.</p>';
    }
}

async function updateGist() {
    if (!ghToken || !gistId) return alert("Configuration manquante");

    try {
        await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `token ${ghToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'movies.json': {
                        content: JSON.stringify(watchlist)
                    }
                }
            })
        });
        // Pas besoin de recharger, l'interface est déjà à jour
    } catch (e) {
        alert("Erreur lors de la sauvegarde sur GitHub");
    }
}

// --- UI & Logique ---

function createCard(item, isWatchlist) {
    const div = document.createElement('div');
    div.className = 'card';
    
    const title = item.title || item.name;
    const date = item.release_date || item.first_air_date || 'Date inconnue';
    const poster = item.poster_path ? IMG_BASE + item.poster_path : 'https://via.placeholder.com/500x750?text=No+Image';

    div.innerHTML = `
        <img src="${poster}" alt="${title}">
        <div class="card-info">
            <h4>${title}</h4>
            <p>${date.substring(0,4)}</p>
            <button class="${isWatchlist ? 'btn-remove' : 'btn-add'}">
                ${isWatchlist ? 'Retirer' : 'Ajouter'}
            </button>
        </div>
    `;

    const btn = div.querySelector('button');
    btn.addEventListener('click', () => {
        if (isWatchlist) {
            removeFromList(item.id);
        } else {
            addToList(item);
            resultsDiv.classList.add('hidden');
            searchInput.value = '';
        }
    });

    return div;
}

function addToList(item) {
    // Éviter les doublons
    if (!watchlist.find(i => i.id === item.id)) {
        watchlist.unshift(item); // Ajouter au début
        renderWatchlist();
        updateGist();
    }
}

function removeFromList(id) {
    watchlist = watchlist.filter(i => i.id !== id);
    renderWatchlist();
    updateGist();
}

function renderWatchlist() {
    myListDiv.innerHTML = '';
    if (watchlist.length === 0) {
        myListDiv.innerHTML = '<p class="empty-msg">Ta liste est vide.</p>';
        return;
    }
    watchlist.forEach(item => {
        myListDiv.appendChild(createCard(item, true));
    });
}

function saveConfig() {
    const token = document.getElementById('gh-token').value;
    const id = document.getElementById('gist-id').value;
    
    if (token && id) {
        localStorage.setItem('gh_token', token);
        localStorage.setItem('gist_id', id);
        ghToken = token;
        gistId = id;
        configModal.classList.add('hidden');
        fetchWatchlist();
    }
}

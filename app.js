const TMDB_KEY = 'd8b62990089ff760df22fac251ad7371';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

let watchlist = [];
let ghToken = localStorage.getItem('gh_token') || '';
let gistId = null;

// Éléments
const searchInput = document.getElementById('search-input');
const resultsOverlay = document.getElementById('search-results');
const myListDiv = document.getElementById('my-list');
const configModal = document.getElementById('config-modal');

// Init
if (!ghToken) {
    configModal.classList.remove('hidden');
    myListDiv.innerHTML = '<p class="status-msg">Veuillez configurer GitHub pour voir votre liste.</p>';
} else {
    initGitHub();
}

// --- LOGIQUE GITHUB (AUTO-SYNC) ---

async function initGitHub() {
    try {
        const res = await fetch('https://api.github.com/gists', {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        if (!res.ok) throw new Error();
        
        const gists = await res.json();
        // On cherche un gist qui contient le fichier 'movies.json'
        const foundGist = gists.find(g => g.files['movies.json']);

        if (foundGist) {
            gistId = foundGist.id;
            const contentRes = await fetch(foundGist.files['movies.json'].raw_url);
            watchlist = await contentRes.json();
            renderWatchlist();
        } else {
            // Créer le gist s'il n'existe pas
            await createGist();
        }
    } catch (err) {
        alert("Erreur GitHub : vérifiez votre Token.");
        configModal.classList.remove('hidden');
    }
}

async function createGist() {
    const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            description: "CinéList Data",
            public: false,
            files: { "movies.json": { content: "[]" } }
        })
    });
    const data = await res.json();
    gistId = data.id;
    watchlist = [];
    renderWatchlist();
}

async function syncToGitHub() {
    if (!gistId) return;
    await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            files: { "movies.json": { content: JSON.stringify(watchlist) } }
        })
    });
}

// --- LOGIQUE TMDB ---

let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value;
    if (query.length < 2) return resultsOverlay.classList.add('hidden');
    
    searchTimeout = setTimeout(async () => {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=fr-FR&query=${query}`);
        const data = await res.json();
        displayResults(data.results);
    }, 400);
});

function displayResults(results) {
    resultsOverlay.innerHTML = '';
    const filtered = results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    
    filtered.forEach(item => {
        const card = createCard(item, false);
        resultsOverlay.appendChild(card);
    });
    resultsOverlay.classList.remove('hidden');
}

// --- UI ---

function createCard(item, isInWatchlist) {
    const div = document.createElement('div');
    div.className = 'card';
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '----').substring(0, 4);
    const poster = item.poster_path ? IMG_BASE + item.poster_path : 'https://via.placeholder.com/500x750?text=No+Image';

    div.innerHTML = `
        <img src="${poster}" alt="${title}">
        <div class="card-content">
            <h4>${title}</h4>
            <p>${year}</p>
            <button class="${isInWatchlist ? 'btn-remove' : 'btn-add'}">
                ${isInWatchlist ? 'Retirer' : 'Ajouter'}
            </button>
        </div>
    `;

    div.querySelector('button').onclick = () => {
        if (isInWatchlist) {
            watchlist = watchlist.filter(m => m.id !== item.id);
        } else {
            if (!watchlist.some(m => m.id === item.id)) {
                watchlist.unshift(item);
                resultsOverlay.classList.add('hidden');
                searchInput.value = '';
            }
        }
        renderWatchlist();
        syncToGitHub();
    };
    return div;
}

function renderWatchlist() {
    myListDiv.innerHTML = '';
    document.getElementById('items-count').innerText = `${watchlist.length} éléments`;
    
    if (watchlist.length === 0) {
        myListDiv.innerHTML = '<p class="status-msg">Votre liste est vide. Recherchez un film pour commencer !</p>';
        return;
    }
    
    watchlist.forEach(item => {
        myListDiv.appendChild(createCard(item, true));
    });
}

// Config Actions
document.getElementById('btn-settings').onclick = () => configModal.classList.remove('hidden');
document.getElementById('close-config').onclick = () => configModal.classList.add('hidden');
document.getElementById('save-config').onclick = () => {
    const token = document.getElementById('gh-token').value;
    if (token) {
        localStorage.setItem('gh_token', token);
        ghToken = token;
        configModal.classList.add('hidden');
        initGitHub();
    }
};

// Fermer les résultats si on clique ailleurs
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) resultsOverlay.classList.add('hidden');
});

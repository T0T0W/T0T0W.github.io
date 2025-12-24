const TMDB_KEY = 'd8b62990089ff760df22fac251ad7371';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

let watchlist = [];
let ghToken = localStorage.getItem('gh_token') || '';
let gistId = null;

// Éléments
const statusText = document.getElementById('status-text');
const statusBar = document.getElementById('status-bar');
const searchInput = document.getElementById('search-input');
const resultsOverlay = document.getElementById('search-results');
const myListDiv = document.getElementById('my-list');
const configModal = document.getElementById('config-modal');

// Gestionnaire de statut
function updateStatus(msg, active = true, isError = false) {
    statusBar.classList.remove('hidden');
    statusText.innerText = msg;
    statusBar.style.borderColor = isError ? "var(--danger)" : "var(--primary)";
    statusBar.style.color = isError ? "var(--danger)" : "var(--primary)";
    
    // Masquer le spinner si inactif
    document.getElementById('status-spinner').style.display = active ? "inline-block" : "none";

    if (!active) {
        setTimeout(() => statusBar.classList.add('hidden'), 3000);
    }
}

// Initialisation GitHub
async function initGitHub() {
    if (!ghToken) return;
    updateStatus("Connexion à GitHub...");
    try {
        const res = await fetch('https://api.github.com/gists', {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        if (!res.ok) throw new Error("Token invalide");
        
        const gists = await res.json();
        const foundGist = gists.find(g => g.files['movies.json']);

        if (foundGist) {
            gistId = foundGist.id;
            updateStatus("Chargement de votre liste...");
            const contentRes = await fetch(`${foundGist.files['movies.json'].raw_url}?t=${new Date().getTime()}`);
            watchlist = await contentRes.json();
            renderWatchlist();
            updateStatus(`${watchlist.length} titres chargés`, false);
        } else {
            await createGist();
        }
    } catch (err) {
        updateStatus("Erreur : Token GitHub invalide", false, true);
        configModal.classList.remove('hidden');
    }
}

async function createGist() {
    updateStatus("Création de l'espace de stockage...");
    try {
        const res = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: "CinéList Data", public: false,
                files: { "movies.json": { content: "[]" } }
            })
        });
        const data = await res.json();
        gistId = data.id;
        updateStatus("Espace créé avec succès", false);
        renderWatchlist();
    } catch (e) { updateStatus("Erreur création stockage", false, true); }
}

async function syncToGitHub() {
    if (!gistId) return;
    updateStatus("Synchronisation cloud...");
    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: { "movies.json": { content: JSON.stringify(watchlist) } }
            })
        });
        if (res.ok) updateStatus("Liste synchronisée !", false);
        else throw new Error();
    } catch (err) { updateStatus("Erreur de sauvegarde", false, true); }
}

// Recherche TMDb
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (query.length < 2) {
        resultsOverlay.classList.add('hidden');
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        updateStatus(`Recherche : ${query}...`);
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=fr-FR&query=${query}`);
            const data = await res.json();
            displayResults(data.results);
            updateStatus(`${data.results.length} résultats trouvés`, false);
        } catch (err) { updateStatus("Erreur TMDb", false, true); }
    }, 500);
});

function displayResults(results) {
    resultsOverlay.innerHTML = '';
    const filtered = results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    if(filtered.length === 0) {
        resultsOverlay.innerHTML = '<p style="text-align:center;width:100%">Aucun résultat.</p>';
    }
    filtered.forEach(item => resultsOverlay.appendChild(createCard(item, false)));
    resultsOverlay.classList.remove('hidden');
}

function createCard(item, isInWatchlist) {
    const div = document.createElement('div');
    div.className = 'card';
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '----').substring(0, 4);
    const poster = item.poster_path ? IMG_BASE + item.poster_path : 'https://via.placeholder.com/500x750?text=No+Image';

    div.innerHTML = `
        <img src="${poster}" alt="${title}" loading="lazy">
        <div class="card-content">
            <h4>${title}</h4>
            <p>${item.media_type === 'tv' ? 'Série' : 'Film'} • ${year}</p>
            <button class="${isInWatchlist ? 'btn-remove' : 'btn-add'}">
                ${isInWatchlist ? 'Retirer' : 'Ajouter'}
            </button>
        </div>
    `;

    div.querySelector('button').onclick = () => {
        if (isInWatchlist) {
            updateStatus(`Suppression de ${title}...`);
            watchlist = watchlist.filter(m => m.id !== item.id);
        } else {
            if (!watchlist.some(m => m.id === item.id)) {
                updateStatus(`Ajout de ${title}...`);
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
    document.getElementById('items-count').innerText = `${watchlist.length} titres`;
    if (watchlist.length === 0) {
        myListDiv.innerHTML = '<p class="status-msg">Votre liste est vide. Recherchez un titre pour l\'ajouter.</p>';
        return;
    }
    watchlist.forEach(item => myListDiv.appendChild(createCard(item, true)));
}

// Démarrage
if (ghToken) initGitHub();
else {
    myListDiv.innerHTML = '<p class="status-msg">Veuillez configurer votre Token GitHub.</p>';
    configModal.classList.remove('hidden');
}

// Événements boutons
document.getElementById('btn-settings').onclick = () => configModal.classList.remove('hidden');
document.getElementById('close-config').onclick = () => configModal.classList.add('hidden');
document.getElementById('save-config').onclick = () => {
    const token = document.getElementById('gh-token').value.trim();
    if (token) {
        localStorage.setItem('gh_token', token);
        ghToken = token;
        configModal.classList.add('hidden');
        initGitHub();
    }
};

// Clic extérieur pour fermer la recherche
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) resultsOverlay.classList.add('hidden');
});

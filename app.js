const TMDB_KEY = 'd8b62990089ff760df22fac251ad7371';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

let watchlist = [];
let ghToken = localStorage.getItem('gh_token') || '';
let gistId = null;

// Éléments DOM
const searchInput = document.getElementById('search-input');
const resultsOverlay = document.getElementById('search-results');
const myListDiv = document.getElementById('my-list');
const configModal = document.getElementById('config-modal');

console.log("🚀 Application démarrée");

// Init
if (!ghToken) {
    console.warn("⚠️ Aucun Token GitHub trouvé dans le stockage local.");
    configModal.classList.remove('hidden');
    myListDiv.innerHTML = '<p class="status-msg">Veuillez configurer GitHub pour voir votre liste.</p>';
} else {
    console.log("🔑 Token trouvé, tentative de connexion GitHub...");
    initGitHub();
}

// --- LOGIQUE GITHUB (AUTO-SYNC) ---

async function initGitHub() {
    try {
        const res = await fetch('https://api.github.com/gists', {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        
        if (!res.ok) {
            if (res.status === 401) throw new Error("Token invalide ou expiré (401)");
            throw new Error(`Erreur GitHub: ${res.status}`);
        }
        
        const gists = await res.json();
        console.log(`📂 ${gists.length} Gists trouvés sur ton compte.`);

        const foundGist = gists.find(g => g.files['movies.json']);

        if (foundGist) {
            gistId = foundGist.id;
            console.log("✅ Gist 'movies.json' identifié :", gistId);
            
            const contentRes = await fetch(foundGist.files['movies.json'].raw_url);
            watchlist = await contentRes.json();
            console.log("📥 Données récupérées :", watchlist.length, "éléments.");
            renderWatchlist();
        } else {
            console.log("ℹ️ Aucun Gist 'movies.json' trouvé. Création d'un nouveau...");
            await createGist();
        }
    } catch (err) {
        console.error("❌ Échec de l'initialisation GitHub :", err.message);
        alert(err.message);
        configModal.classList.remove('hidden');
    }
}

async function createGist() {
    console.log("🔨 Création du Gist sur GitHub...");
    try {
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
        console.log("✅ Nouveau Gist créé avec ID :", gistId);
        watchlist = [];
        renderWatchlist();
    } catch (err) {
        console.error("❌ Erreur lors de la création du Gist :", err);
    }
}

async function syncToGitHub() {
    if (!gistId) {
        console.error("❌ Impossible de synchroniser : ID du Gist manquant.");
        return;
    }

    console.log("📤 Synchronisation avec GitHub en cours...");
    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: { "movies.json": { content: JSON.stringify(watchlist) } }
            })
        });

        if (res.ok) {
            console.log("✅ Synchronisation réussie ! (Serveur mis à jour)");
        } else {
            const errorMsg = await res.text();
            console.error("❌ Erreur de synchro :", res.status, errorMsg);
        }
    } catch (err) {
        console.error("❌ Erreur réseau lors de la synchro :", err);
    }
}

// --- LOGIQUE TMDB ---

let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value;
    if (query.length < 2) {
        resultsOverlay.classList.add('hidden');
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        console.log(`🔍 Recherche TMDb pour : "${query}"`);
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=fr-FR&query=${query}`);
            const data = await res.json();
            console.log(`✨ ${data.results.length} résultats trouvés.`);
            displayResults(data.results);
        } catch (err) {
            console.error("❌ Erreur recherche TMDb :", err);
        }
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
            console.log(`🗑️ Retrait de : ${title}`);
            watchlist = watchlist.filter(m => m.id !== item.id);
        } else {
            if (!watchlist.some(m => m.id === item.id)) {
                console.log(`➕ Ajout de : ${title}`);
                watchlist.unshift(item);
                resultsOverlay.classList.add('hidden');
                searchInput.value = '';
            } else {
                console.warn(`⚠️ ${title} est déjà dans la liste.`);
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
        myListDiv.innerHTML = '<p class="status-msg">Votre liste est vide.</p>';
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
    const token = document.getElementById('gh-token').value.trim();
    if (token) {
        console.log("💾 Nouveau token enregistré.");
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

const TMDB = "d8b62990089ff760df22fac251ad7371";
const IMG = "https://image.tmdb.org/t/p/w500";

let list = JSON.parse(localStorage.getItem("list")) || [];

function save() {
  localStorage.setItem("list", JSON.stringify(list));
  render();
}

async function search() {
  const q = document.getElementById("q").value;
  const r = await fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${TMDB}&language=fr-FR&query=${q}`
  );
  const d = await r.json();
  const el = document.getElementById("results");
  el.innerHTML = "";
  d.results.filter(x => x.media_type !== "person").forEach(m => {
    el.innerHTML += `
      <div>
        <img src="${IMG + m.poster_path}" width="80">
        <b>${m.title || m.name}</b>
        <button onclick='add(${JSON.stringify(m)})'>➕</button>
      </div>
    `;
  });
}

function add(m) {
  m.status = "À voir";
  list.push(m);
  save();
}

function render() {
  const el = document.getElementById("list");
  el.innerHTML = "";
  list.forEach(m => {
    el.innerHTML += `
      <div>
        <img src="${IMG + m.poster_path}" width="80">
        <b>${m.title || m.name}</b>
        (${m.status})
        <button onclick="toggle(${m.id})">👁️</button>
        <button onclick="del(${m.id})">🗑️</button>
      </div>
    `;
  });
}

function toggle(id) {
  const m = list.find(x => x.id === id);
  m.status = m.status === "À voir" ? "Vu" : "À voir";
  save();
}

function del(id) {
  list = list.filter(x => x.id !== id);
  save();
}

render();

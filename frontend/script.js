const API_BASE = "http://127.0.0.1:5000";

// ===== App State =====
let metaLocations  = {};
let allChartData   = null;
let lastPrediction = null;   // most recent prediction result (for Save)

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
    addInputEffects();
    loadMeta();
    loadChartData();
    renderHistory();
});

// ===== Load Meta =====
async function loadMeta() {
    try {
        const res  = await fetch(`${API_BASE}/api/meta`);
        const meta = await res.json();
        metaLocations = meta.locations || {};
        const pct = Math.round(meta.r2_score * 100);
        document.getElementById('modelAccuracy').textContent =
            `Gradient Boosting · R² ${pct}% · MAE ₹${(meta.mae/100000).toFixed(1)}L`;
        populateChartStateDropdown("All");
    } catch {
        document.getElementById('modelAccuracy').textContent =
            'Gradient Boosting model · Start backend to see accuracy';
    }
}

// ==========================================
//  CALCULATOR — Cascading Dropdowns
// ==========================================

const CATEGORY_HINTS = {
    Suburban: "Tier-2 cities — Jaipur, Lucknow, Kochi, Chandigarh…",
    Urban:    "Metro cities — Bangalore, Hyderabad, Pune, Chennai…",
    Premium:  "Prime zones — Delhi, Mumbai, Bangalore premium areas"
};

function onCategoryChange() {
    const cat     = document.getElementById('category').value;
    const stateEl = document.getElementById('state');
    const cityEl  = document.getElementById('city');
    document.getElementById('categoryHint').textContent = CATEGORY_HINTS[cat] || '';
    stateEl.innerHTML = '<option value="" disabled selected>Select state</option>';
    cityEl.innerHTML  = '<option value="" disabled selected>Select city</option>';
    stateEl.disabled  = true; cityEl.disabled = true;
    document.getElementById('stateHint').textContent = '';
    document.getElementById('cityHint').textContent  = 'Choose state first';
    if (!cat || !metaLocations[cat]) return;
    const states = [...new Set(metaLocations[cat].map(e => e.state))].sort();
    states.forEach(s => { const o = new Option(s,s); stateEl.appendChild(o); });
    stateEl.disabled = false;
    document.getElementById('stateHint').textContent = `${states.length} state(s) available`;
}

function onStateChange() {
    const cat    = document.getElementById('category').value;
    const state  = document.getElementById('state').value;
    const cityEl = document.getElementById('city');
    cityEl.innerHTML = '<option value="" disabled selected>Select city</option>';
    cityEl.disabled  = true;
    document.getElementById('cityHint').textContent = '';
    if (!cat || !state) return;
    const cities = metaLocations[cat].filter(e => e.state===state).map(e=>e.city).sort();
    cities.forEach(c => { const o = new Option(c,c); cityEl.appendChild(o); });
    cityEl.disabled = false;
    document.getElementById('cityHint').textContent = `${cities.length} city(ies) in ${state}`;
}

// ==========================================
//  PREDICT
// ==========================================

function predictPrice() {
    const sqftRaw  = document.getElementById("sqft").value.trim();
    const bathRaw  = document.getElementById("bath").value.trim();
    const bhkRaw   = document.getElementById("bhk").value.trim();
    const category = document.getElementById("category").value;
    const state    = document.getElementById("state").value;
    const city     = document.getElementById("city").value;

    if (!sqftRaw || !bathRaw || !bhkRaw || !category || !state || !city) {
        showError("Please fill in all fields — Category, State, City, Area, Bathrooms, and BHK.");
        return;
    }
    const sqft = parseFloat(sqftRaw), bath = parseFloat(bathRaw), bhk = parseFloat(bhkRaw);
    if (isNaN(sqft)||isNaN(bath)||isNaN(bhk)) { showError("Enter valid numbers."); return; }
    if (sqft<=0||bath<=0||bhk<=0)             { showError("Values must be greater than zero."); return; }
    if (sqft>20000)                            { showError("Area seems unrealistically large."); return; }

    const loading   = document.getElementById("loading");
    const resultBox = document.getElementById("resultContainer");
    const predictBtn= document.getElementById("predictBtn");
    loading.classList.add("active");
    resultBox.classList.remove("active","error");
    predictBtn.disabled = true; predictBtn.style.opacity = "0.6";

    fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sqft, bath, bhk, city, state, category })
    })
    .then(r => r.json())
    .then(data => {
        loading.classList.remove("active");
        predictBtn.disabled = false; predictBtn.style.opacity = "1";
        data.error ? showError("Error: " + data.error) : showResult(data, sqft, bath, bhk);
    })
    .catch(() => {
        loading.classList.remove("active");
        predictBtn.disabled = false; predictBtn.style.opacity = "1";
        showError("Cannot connect to backend. Make sure run_backend.bat is running on port 5000.");
    });
}

async function showResult(data, sqft, bath, bhk) {
    lastPrediction = { ...data, sqft, bath, bhk };

    document.getElementById("result").textContent    = "₹ " + formatINR(data.price);
    document.getElementById("resultRange").textContent =
        `Range: ₹ ${formatINR(data.price_low)} – ₹ ${formatINR(data.price_high)}`;
    document.getElementById("resultMeta").textContent  =
        `${data.city}, ${data.state} · ${data.category} · ${sqft} sqft`;

    const box = document.getElementById("resultContainer");
    box.classList.remove("error");
    box.classList.add("active");
    box.style.animation = "none";
    setTimeout(() => box.style.animation = "slideIn 0.5s ease-out", 10);

    // Efficiency score
    await showEfficiency(data.price, sqft, data.city, data.category);

    // Show save button
    const saveBtn = document.getElementById("btnSave");
    saveBtn.style.display = "inline-flex";
    saveBtn.classList.remove("saved");
    saveBtn.innerHTML = '<i class="fas fa-bookmark"></i> Save to History';

    // Sync analytics
    syncAnalyticsToInput(data.category, data.state, data.city, sqft);
    updatePredictionChart(sqft, data.price, data.city, data.category);
}

// ── Efficiency Score ──────────────────────────────────────────────────────────
async function showEfficiency(price, sqft, city, category) {
    const row   = document.getElementById("efficiencyRow");
    const badge = document.getElementById("efficiencyBadge");
    const label = document.getElementById("efficiencyLabel");
    const ppsqft = price / sqft;

    try {
        const res  = await fetch(`${API_BASE}/api/efficiency?city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const mktAvg = data.market_avg_per_sqft;
        const ratio  = ppsqft / mktAvg;
        const ppsqftFmt = "₹" + formatINR(Math.round(ppsqft)) + "/sqft";

        let cls, icon, text;
        if (ratio <= 0.95)       { cls="great";  icon="✅"; text="Below market avg — great value"; }
        else if (ratio <= 1.08)  { cls="fair";   icon="⚖️"; text="Near market average"; }
        else                     { cls="pricey"; icon="⚠️"; text="Above market avg — premium pricing"; }

        badge.className = `efficiency-badge ${cls}`;
        badge.innerHTML = `${icon} ${ppsqftFmt}`;
        label.textContent = `${text} (market avg ₹${formatINR(Math.round(mktAvg))}/sqft)`;
        row.style.display = "flex";
    } catch {
        // No backend data — just show raw ₹/sqft
        badge.className = "efficiency-badge fair";
        badge.innerHTML = `₹${formatINR(Math.round(ppsqft))}/sqft`;
        label.textContent = "Price per sq ft";
        row.style.display = "flex";
    }
}

function showError(msg) {
    const box = document.getElementById("resultContainer");
    document.getElementById("result").textContent     = msg;
    document.getElementById("resultRange").textContent = "";
    document.getElementById("resultMeta").textContent  = "";
    document.getElementById("efficiencyRow").style.display = "none";
    document.getElementById("btnSave").style.display = "none";
    box.classList.add("error","active");
    box.style.animation = "none";
    setTimeout(() => box.style.animation = "slideIn 0.5s ease-out", 10);
}

// ==========================================
//  COMPARE MODE
// ==========================================

// Cascading dropdowns for compare panels
function onCmpCategoryChange(side) {
    const cat     = document.getElementById(`cmp_${side}_cat`).value;
    const stateEl = document.getElementById(`cmp_${side}_state`);
    const cityEl  = document.getElementById(`cmp_${side}_city`);
    stateEl.innerHTML = '<option value="" disabled selected>Select</option>';
    cityEl.innerHTML  = '<option value="" disabled selected>Select</option>';
    stateEl.disabled  = true; cityEl.disabled = true;
    if (!cat || !metaLocations[cat]) return;
    const states = [...new Set(metaLocations[cat].map(e => e.state))].sort();
    states.forEach(s => stateEl.appendChild(new Option(s, s)));
    stateEl.disabled = false;
}

function onCmpStateChange(side) {
    const cat    = document.getElementById(`cmp_${side}_cat`).value;
    const state  = document.getElementById(`cmp_${side}_state`).value;
    const cityEl = document.getElementById(`cmp_${side}_city`);
    cityEl.innerHTML = '<option value="" disabled selected>Select</option>';
    cityEl.disabled  = true;
    if (!cat || !state) return;
    const cities = metaLocations[cat].filter(e=>e.state===state).map(e=>e.city).sort();
    cities.forEach(c => cityEl.appendChild(new Option(c, c)));
    cityEl.disabled = false;
}

function getCmpProp(side) {
    return {
        sqft    : parseFloat(document.getElementById(`cmp_${side}_sqft`).value),
        bath    : parseFloat(document.getElementById(`cmp_${side}_bath`).value),
        bhk     : parseFloat(document.getElementById(`cmp_${side}_bhk`).value),
        city    : document.getElementById(`cmp_${side}_city`).value,
        state   : document.getElementById(`cmp_${side}_state`).value,
        category: document.getElementById(`cmp_${side}_cat`).value,
    };
}

async function runCompare() {
    const propA = getCmpProp('a');
    const propB = getCmpProp('b');

    for (const [lbl, p] of [["A", propA], ["B", propB]]) {
        if (!p.city || !p.state || !p.category || isNaN(p.sqft) || isNaN(p.bath) || isNaN(p.bhk)) {
            alert(`Please fill in all fields for Property ${lbl}.`);
            return;
        }
    }

    const loading    = document.getElementById("compareLoading");
    const compareBtn = document.getElementById("compareBtn");
    loading.classList.add("active");
    compareBtn.disabled = true; compareBtn.style.opacity = "0.6";
    document.getElementById("compareSummary").style.display    = "none";
    document.getElementById("compareChartCard").style.display  = "none";

    try {
        const res  = await fetch(`${API_BASE}/compare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ properties: [propA, propB] })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        loading.classList.remove("active");
        compareBtn.disabled = false; compareBtn.style.opacity = "1";
        renderCompareResults(data.results[0], data.results[1]);
    } catch (err) {
        loading.classList.remove("active");
        compareBtn.disabled = false; compareBtn.style.opacity = "1";
        alert("Compare failed: " + err.message);
    }
}

function renderCompareResults(rA, rB) {
    const winnerA = rA.price <= rB.price;   // cheaper = better value by price
    const ppsA = rA.price_per_sqft;
    const ppsB = rB.price_per_sqft;
    const efficientA = ppsA <= ppsB;        // lower ₹/sqft wins efficiency

    // Overall winner = lower total price
    const winner = winnerA ? "A" : "B";

    renderCmpCard("cmpResultA", rA, winnerA, ppsA, efficientA);
    renderCmpCard("cmpResultB", rB, !winnerA, ppsB, !efficientA);

    // Summary
    const diff = Math.abs(rA.price - rB.price);
    const diffPct = ((diff / Math.max(rA.price, rB.price)) * 100).toFixed(1);
    const cheaper = winnerA ? rA : rB;
    const pricierLabel = winnerA ? "B" : "A";
    document.getElementById("compareSummary").innerHTML =
        `<i class="fas fa-lightbulb" style="color:#fbbf24;"></i>
         &nbsp;<strong>Property ${winner}</strong> is cheaper by <strong>₹${formatINR(Math.round(diff))}</strong>
         (${diffPct}% less than Property ${pricierLabel}) &nbsp;·&nbsp;
         ₹/sqft: A = <strong>₹${formatINR(Math.round(ppsA))}</strong> &nbsp;vs&nbsp; B = <strong>₹${formatINR(Math.round(ppsB))}</strong>`;
    document.getElementById("compareSummary").style.display = "block";

    // Bar chart
    buildCompareChart(rA, rB);
}

function renderCmpCard(id, r, isWinner, pps, efficientPps) {
    const el = document.getElementById(id);
    el.className = `compare-result ${isWinner ? "winner" : "loser"}`;
    el.innerHTML = `
        <div class="cmp-price">₹ ${formatINR(r.price)}</div>
        <div class="cmp-range">Range: ₹${formatINR(r.price_low)} – ₹${formatINR(r.price_high)}</div>
        <div class="cmp-meta">${r.city}, ${r.state} · ${r.category} · ${r.sqft} sqft</div>
        <div class="cmp-meta">${r.bhk} BHK · ${r.bath} bath</div>
        <div class="cmp-ppsqft" style="color:${efficientPps?'#059669':'#d97706'}">
            ${efficientPps ? '✅' : '⚠️'} ₹${formatINR(Math.round(pps))}/sqft
        </div>
        ${isWinner
            ? '<span class="cmp-winner-badge">🏆 Better Value</span>'
            : '<span class="cmp-loser-note">Higher priced option</span>'}
    `;
    el.style.display = "block";
}

function buildCompareChart(rA, rB) {
    const card = document.getElementById("compareChartCard");
    card.style.display = "block";
    const existing = Chart.getChart(document.getElementById("compareBarChart"));
    if (existing) existing.destroy();

    new Chart(document.getElementById("compareBarChart"), {
        type: "bar",
        data: {
            labels: [
                `A · ${rA.city}`,
                `B · ${rB.city}`,
            ],
            datasets: [
                {
                    label: "Total Price",
                    data: [rA.price, rB.price],
                    backgroundColor: ["rgba(102,126,234,0.75)", "rgba(240,147,251,0.75)"],
                    borderColor: ["#667eea", "#f093fb"],
                    borderWidth: 2, borderRadius: 8, borderSkipped: false,
                    yAxisID: "y",
                },
                {
                    label: "₹ per sqft",
                    data: [rA.price_per_sqft, rB.price_per_sqft],
                    backgroundColor: ["rgba(102,126,234,0.25)", "rgba(240,147,251,0.25)"],
                    borderColor: ["#667eea", "#f093fb"],
                    borderWidth: 2, borderRadius: 8, borderSkipped: false,
                    yAxisID: "y2",
                    type: "bar",
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "top" },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const v = ctx.parsed.y;
                            return ctx.dataset.label + ": ₹" + formatINR(Math.round(v));
                        }
                    }
                }
            },
            scales: {
                y:  { beginAtZero: true, ticks: { callback: v => "₹"+(v/100000).toFixed(0)+"L" }, title: { display: true, text: "Total Price" } },
                y2: { beginAtZero: true, position: "right", ticks: { callback: v => "₹"+v.toFixed(0) }, title: { display: true, text: "₹/sqft" }, grid: { drawOnChartArea: false } },
            }
        }
    });
}

// ==========================================
//  PREDICTION HISTORY  (localStorage)
// ==========================================

const HISTORY_KEY = "estateai_history";

function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
}
function setHistory(arr) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}

function saveToHistory() {
    if (!lastPrediction) return;
    const h = getHistory();
    const entry = {
        id       : Date.now(),
        price    : lastPrediction.price,
        price_low: lastPrediction.price_low,
        price_high:lastPrediction.price_high,
        city     : lastPrediction.city,
        state    : lastPrediction.state,
        category : lastPrediction.category,
        sqft     : lastPrediction.sqft,
        bath     : lastPrediction.bath,
        bhk      : lastPrediction.bhk,
        ppsqft   : Math.round(lastPrediction.price / lastPrediction.sqft),
        savedAt  : new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }),
    };
    h.unshift(entry);
    if (h.length > 50) h.length = 50;   // cap at 50 entries
    setHistory(h);
    renderHistory();

    const btn = document.getElementById("btnSave");
    btn.classList.add("saved");
    btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
}

function deleteHistoryItem(id) {
    const h = getHistory().filter(e => e.id !== id);
    setHistory(h);
    renderHistory();
}

function clearHistory() {
    if (!confirm("Clear all saved predictions?")) return;
    setHistory([]);
    renderHistory();
}

function renderHistory() {
    const h   = getHistory();
    const list= document.getElementById("historyList");
    document.getElementById("historyCount").textContent = `${h.length} saved`;

    if (h.length === 0) {
        list.innerHTML = `<div class="history-empty">
            <i class="fas fa-clock"></i>
            <p>No predictions saved yet.<br>Hit <strong>Save to History</strong> after a valuation.</p>
        </div>`;
        return;
    }

    list.innerHTML = h.map(e => `
        <div class="history-item">
            <button class="btn-history-delete" onclick="deleteHistoryItem(${e.id})" title="Remove"><i class="fas fa-times"></i></button>
            <div class="history-item-price">₹ ${formatINR(e.price)}</div>
            <div class="history-item-meta">${e.city}, ${e.state}</div>
            <div class="history-item-tags">
                <span class="history-tag">${e.category}</span>
                <span class="history-tag">${e.sqft} sqft</span>
                <span class="history-tag">${e.bhk} BHK</span>
                <span class="history-tag">${e.bath} bath</span>
                <span class="history-tag">₹${formatINR(e.ppsqft)}/sqft</span>
            </div>
            <div class="history-item-time"><i class="fas fa-clock" style="margin-right:4px;"></i>${e.savedAt}</div>
        </div>
    `).join('');
}

// ==========================================
//  ANALYTICS — existing logic (unchanged)
// ==========================================

function onChartCategoryChange() {
    const cat = document.getElementById('chartCategory').value;
    populateChartStateDropdown(cat);
    refreshCharts();
}

function populateChartStateDropdown(cat) {
    const stateEl = document.getElementById('chartState');
    stateEl.innerHTML = '<option value="All">All States</option>';
    if (!metaLocations) return;
    let states = [];
    if (cat === "All") {
        Object.values(metaLocations).forEach(arr => arr.forEach(e => { if (!states.includes(e.state)) states.push(e.state); }));
    } else if (metaLocations[cat]) {
        states = [...new Set(metaLocations[cat].map(e => e.state))];
    }
    states.sort().forEach(s => stateEl.appendChild(new Option(s, s)));
    document.getElementById('chartCity').innerHTML = '<option value="All">All Cities</option>';
}

function populateChartCityDropdown(cat, state) {
    const cityEl = document.getElementById('chartCity');
    cityEl.innerHTML = '<option value="All">All Cities</option>';
    if (!metaLocations) return;
    let cities = [];
    if (cat === "All") {
        Object.values(metaLocations).forEach(arr => arr.filter(e => state==="All"||e.state===state).forEach(e => { if (!cities.includes(e.city)) cities.push(e.city); }));
    } else if (metaLocations[cat]) {
        cities = metaLocations[cat].filter(e => state==="All"||e.state===state).map(e => e.city);
    }
    cities.sort().forEach(c => cityEl.appendChild(new Option(c, c)));
}

function onChartStateChange() {
    const cat   = document.getElementById('chartCategory').value;
    const state = document.getElementById('chartState').value;
    populateChartCityDropdown(cat, state);
    refreshCharts();
}

async function loadChartData(userSqft) {
    const category = document.getElementById('chartCategory')?.value || "All";
    const state    = document.getElementById('chartState')?.value    || "All";
    const city     = document.getElementById('chartCity')?.value     || "All";

    let url = `${API_BASE}/api/data`;
    const params = [];
    if (category !== "All") params.push(`category=${encodeURIComponent(category)}`);
    if (state    !== "All") params.push(`state=${encodeURIComponent(state)}`);
    if (city     !== "All") params.push(`city=${encodeURIComponent(city)}`);
    if (params.length) url += "?" + params.join("&");

    try {
        const res    = await fetch(url);
        const result = await res.json();
        if (result.error) { loadDemoData(); return; }
        allChartData = result.data;
        const filtered = userSqft ? applySqftRangeFilter(allChartData, userSqft) : applyClientSizeFilter(allChartData);
        updateStatisticsFromData(filtered, result.stats);
        updateActiveFilterBadge(userSqft, city, category);
        buildAllCharts(filtered);
    } catch { loadDemoData(); }
}

function applySqftRangeFilter(data, userSqft) {
    const low = userSqft * 0.70, high = userSqft * 1.30;
    let idx = data.sqft.reduce((a,s,i)=>{if(s>=low&&s<=high)a.push(i);return a;},[]);
    if (idx.length < 2) idx = data.sqft.reduce((a,s,i)=>{if(s>=userSqft*0.50&&s<=userSqft*1.50)a.push(i);return a;},[]);
    const pick = arr => idx.map(i=>arr[i]);
    return {sqft:pick(data.sqft),bath:pick(data.bath),bhk:pick(data.bhk),price:pick(data.price),city:pick(data.city),state:pick(data.state),category:pick(data.category)};
}

function applyClientSizeFilter(data) {
    const f = document.getElementById('chartSize')?.value || "any";
    if (f==="any") return data;
    const idx = data.sqft.reduce((a,s,i)=>{
        if(f==="small"&&s<1000)a.push(i);
        if(f==="medium"&&s>=1000&&s<=2000)a.push(i);
        if(f==="large"&&s>2000)a.push(i);
        return a;},[]);
    const pick = arr => idx.map(i=>arr[i]);
    return {sqft:pick(data.sqft),bath:pick(data.bath),bhk:pick(data.bhk),price:pick(data.price),city:pick(data.city),state:pick(data.state),category:pick(data.category)};
}

function updateStatisticsFromData(filtered, fallbackStats) {
    if (filtered.price?.length > 0) {
        const avg_price  = filtered.price.reduce((a,b)=>a+b,0)/filtered.price.length;
        const avg_area   = filtered.sqft.reduce((a,b)=>a+b,0)/filtered.sqft.length;
        const bhkCount   = {};
        filtered.bhk.forEach(b=>{bhkCount[b]=(bhkCount[b]||0)+1;});
        const common_bhk = Object.keys(bhkCount).sort((a,b)=>bhkCount[b]-bhkCount[a])[0];
        updateStatistics({avg_price,avg_area,common_bhk:parseInt(common_bhk),total_records:filtered.price.length,r2_score:fallbackStats.r2_score});
    } else { updateStatistics(fallbackStats); }
}

function updateActiveFilterBadge(userSqft, city, category) {
    let badge = document.getElementById('activeFilterBadge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'activeFilterBadge'; badge.className = 'active-filter-badge';
        document.querySelector('.section-header').appendChild(badge);
    }
    if (userSqft) {
        const low=Math.round(userSqft*0.70), high=Math.round(userSqft*1.30);
        badge.innerHTML=`<i class="fas fa-filter"></i> Showing: <strong>${low}–${high} sqft</strong> in <strong>${city}</strong> (${category}) &nbsp;<button onclick="resetFilters()" class="badge-reset">✕ Clear</button>`;
        badge.style.display='flex';
    } else { badge.style.display='none'; }
}

function refreshCharts() { loadChartData(); }

function resetFilters() {
    document.getElementById('chartCategory').value="All";
    document.getElementById('chartSize').value="any";
    populateChartStateDropdown("All");
    const badge=document.getElementById('activeFilterBadge');
    if(badge) badge.style.display='none';
    loadChartData();
}

function updateStatistics(stats) {
    document.getElementById('avgPrice').textContent    ='₹ '+formatINR(stats.avg_price);
    document.getElementById('avgArea').textContent     =Math.round(stats.avg_area)+' sqft';
    document.getElementById('commonBHK').textContent   =stats.common_bhk+' BHK';
    document.getElementById('totalRecords').textContent=stats.total_records;
    if(stats.r2_score) document.getElementById('r2Score').textContent=Math.round(stats.r2_score*100)+'%';
}

function syncAnalyticsToInput(category, state, city, userSqft) {
    document.getElementById('chartCategory').value=category;
    populateChartStateDropdown(category);
    const stateEl=document.getElementById('chartState');
    for(let o of stateEl.options){if(o.value===state){o.selected=true;break;}}
    populateChartCityDropdown(category,state);
    const cityEl=document.getElementById('chartCity');
    for(let o of cityEl.options){if(o.value===city){o.selected=true;break;}}
    loadChartData(userSqft);
}

function loadDemoData() {
    allChartData={sqft:[800,1000,1200,1500,1800,2000],bath:[1,2,2,3,3,4],bhk:[1,2,2,3,3,4],
        price:[5200000,7000000,8500000,12500000,15500000,17000000],
        city:['Bangalore','Bangalore','Hyderabad','Pune','Hyderabad','Bangalore'],
        state:['Karnataka','Karnataka','Telangana','Maharashtra','Telangana','Karnataka'],
        category:['Urban','Urban','Urban','Urban','Urban','Urban']};
    updateStatistics({avg_price:11116666,avg_area:1383,common_bhk:3,total_records:6,r2_score:0.72});
    buildAllCharts(allChartData);
}

// ==========================================
//  CHARTS
// ==========================================

const PALETTE=['#667eea','#764ba2','#f093fb','#4facfe','#10b981','#fbbf24','#f87171','#34d399','#60a5fa','#a78bfa','#fb923c','#e879f9'];

function buildAllCharts(data) {
    if(!data?.sqft?.length) return;
    buildPriceAreaChart(data); buildPriceTrendChart(data); buildCityChart(data); buildBHKChart(data);
}

function destroyExisting(id){const c=Chart.getChart(document.getElementById(id));if(c)c.destroy();}

function baseOptions(tickFmt,tipFmt){
    return{responsive:true,maintainAspectRatio:true,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>tipFmt(ctx.parsed.y)}}},
        scales:{y:{beginAtZero:true,ticks:{callback:tickFmt}}}};
}

function buildPriceAreaChart(data){
    destroyExisting('priceAreaChart');
    const s=data.sqft.map((s,i)=>({s,p:data.price[i]})).sort((a,b)=>a.s-b.s);
    new Chart(document.getElementById('priceAreaChart'),{type:'bar',
        data:{labels:s.map(d=>d.s+' sqft'),datasets:[{data:s.map(d=>d.p),
            backgroundColor:s.map((_,i)=>PALETTE[i%PALETTE.length]+'cc'),
            borderColor:s.map((_,i)=>PALETTE[i%PALETTE.length]),
            borderWidth:2,borderRadius:6,borderSkipped:false}]},
        options:baseOptions(v=>'₹'+(v/100000).toFixed(0)+'L',v=>'₹ '+formatINR(v))});
}

function buildPriceTrendChart(data){
    destroyExisting('priceTrendChart');
    const s=data.sqft.map((s,i)=>({s,p:data.price[i]})).sort((a,b)=>a.s-b.s);
    new Chart(document.getElementById('priceTrendChart'),{type:'line',
        data:{labels:s.map(d=>d.s+' sqft'),datasets:[{data:s.map(d=>d.p),
            borderColor:'#667eea',backgroundColor:'rgba(102,126,234,0.12)',
            borderWidth:3,fill:true,tension:0.4,
            pointBackgroundColor:'#764ba2',pointBorderColor:'#fff',
            pointBorderWidth:2,pointRadius:5,pointHoverRadius:8}]},
        options:baseOptions(v=>'₹'+(v/100000).toFixed(0)+'L',v=>'₹ '+formatINR(v))});
}

function buildCityChart(data){
    destroyExisting('cityChart');
    const groups={};
    data.city.forEach((c,i)=>{if(!groups[c])groups[c]=[];groups[c].push(data.price[i]);});
    const labels=Object.keys(groups).sort();
    const avgs=labels.map(l=>Math.round(groups[l].reduce((a,b)=>a+b,0)/groups[l].length));
    new Chart(document.getElementById('cityChart'),{type:'bar',
        data:{labels,datasets:[{data:avgs,
            backgroundColor:labels.map((_,i)=>PALETTE[i%PALETTE.length]+'cc'),
            borderColor:labels.map((_,i)=>PALETTE[i%PALETTE.length]),
            borderWidth:2,borderRadius:8,borderSkipped:false}]},
        options:baseOptions(v=>'₹'+(v/100000).toFixed(0)+'L',v=>'Avg: ₹ '+formatINR(v))});
}

function buildBHKChart(data){
    destroyExisting('bhkChart');
    const counts={};
    data.bhk.forEach(b=>{counts[b]=(counts[b]||0)+1;});
    const labels=Object.keys(counts).sort((a,b)=>a-b).map(k=>k+' BHK');
    const values=Object.keys(counts).sort((a,b)=>a-b).map(k=>counts[k]);
    new Chart(document.getElementById('bhkChart'),{type:'doughnut',
        data:{labels,datasets:[{data:values,
            backgroundColor:PALETTE.slice(0,labels.length).map(c=>c+'cc'),
            borderColor:'#fff',borderWidth:3,hoverOffset:12}]},
        options:{responsive:true,
            plugins:{legend:{position:'bottom',labels:{padding:15,font:{size:12}}},
                     tooltip:{callbacks:{label:ctx=>ctx.label+': '+ctx.parsed+' listings'}}}}});
}

function updatePredictionChart(userSqft,userPrice,userCity,userCategory){
    const card=document.getElementById('predictionChartCard');
    card.style.display='block';
    destroyExisting('predictionChart');
    const base=allChartData||{sqft:[],price:[],city:[],category:[]};
    const sqftLow=userSqft*0.75,sqftHigh=userSqft*1.25;
    let indices=base.sqft.reduce((acc,s,i)=>{
        if(s>=sqftLow&&s<=sqftHigh&&(base.city[i]===userCity||base.category[i]===userCategory))acc.push(i);
        return acc;},[]);
    if(indices.length<2){
        const wl=userSqft*0.60,wh=userSqft*1.40;
        indices=base.sqft.reduce((acc,s,i)=>{
            if(s>=wl&&s<=wh&&base.category[i]===userCategory)acc.push(i);
            return acc;},[]);
    }
    const compLabels=indices.map(i=>`${base.sqft[i]} sqft · ${base.city[i]}`);
    const compPrices=indices.map(i=>base.price[i]);
    const allLabels=[...compLabels,`★ Yours: ${userSqft} sqft`];
    const allPrices=[...compPrices,userPrice];
    const bgColors=[...indices.map(()=>'#667eeacc'),'#ef4444cc'];
    const bdColors=[...indices.map(()=>'#667eea'),'#ef4444'];
    const rangeLabel=`${Math.round(sqftLow)}–${Math.round(sqftHigh)} sqft`;
    document.querySelector('#predictionChartCard h3').innerHTML=
        `<i class="fas fa-crosshairs"></i> Your Prediction vs. Similar Properties <span class="chart-filter-tag">${userCity} · ${rangeLabel}</span>`;
    new Chart(document.getElementById('predictionChart'),{type:'bar',
        data:{labels:allLabels,datasets:[{data:allPrices,backgroundColor:bgColors,
            borderColor:bdColors,borderWidth:2,borderRadius:6,borderSkipped:false}]},
        options:{...baseOptions(v=>'₹'+(v/100000).toFixed(0)+'L',v=>'₹ '+formatINR(v)),
            plugins:{legend:{display:false},
                tooltip:{callbacks:{label:ctx=>'₹ '+formatINR(ctx.parsed.y),
                    afterLabel:ctx=>ctx.dataIndex===allLabels.length-1?'← Your prediction':'Similar property'}}}}});
    card.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ==========================================
//  UTILITIES
// ==========================================

function formatINR(p){
    if(p>=10000000)return(p/10000000).toFixed(2)+" Cr";
    if(p>=100000)  return(p/100000).toFixed(2)+" L";
    return p.toLocaleString('en-IN');
}

function addInputEffects(){
    document.querySelectorAll('input[type="number"], select').forEach(el=>{
        el.addEventListener('focus',()=>el.closest('.form-group')?.style.setProperty('transform','translateY(-2px)'));
        el.addEventListener('blur', ()=>el.closest('.form-group')?.style.setProperty('transform','translateY(0)'));
    });
}

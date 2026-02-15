// --- Global State ---
let currentLang = 'fr';
let currentMode = 'normal'; // 'normal' (Gross->Net) or 'reverse' (Net->Gross)
let myChart = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Check saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Check saved language
    const savedLang = localStorage.getItem('lang') || 'fr';
    changeLanguage(savedLang);

    // Event Listeners
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('maritalStatus').addEventListener('change', updateFormVisibility);

    // Enter key support
    document.getElementById('salaryInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            calculate();
        }
    });
});

// --- Theme Toggle ---
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// --- Language Switcher ---
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    
    // Update RTL/LTR
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);

    // Update Text Content
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang][key]) {
            element.innerText = translations[lang][key];
        }
    });

    // Update Buttons Active State
    document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.remove('active'));
    // Note: Since we have multiple icon buttons, we should target the lang ones specifically or just rely on the onclick binding check (simplified here)
    // Actually, let's just re-render active states if needed, but the current HTML uses specific onclicks.
    // Let's just manually set the active class for the lang buttons:
    const langButtons = document.querySelectorAll('.icon-btn[onclick^="changeLanguage"]');
    langButtons.forEach(btn => {
        if(btn.getAttribute('onclick').includes(lang)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// --- Mode Switcher ---
function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(mode === 'normal' ? 'modeNormal' : 'modeReverse').classList.add('active');

    // Update placeholder/label based on mode
    const inputLabel = document.getElementById('salaryLabel');
    if (mode === 'normal') {
        inputLabel.innerText = translations[currentLang]['labelBaseSalary'];
    } else {
        inputLabel.innerText = translations[currentLang]['labelFinalSalary'] + " (Cible)";
    }
}

// --- Form Visibility ---
function updateFormVisibility() {
    const status = document.getElementById('maritalStatus').value;
    const spouseGroup = document.getElementById('spouseGroup');
    const childrenGroup = document.getElementById('childrenGroup');

    if (status === 'married') {
        spouseGroup.classList.remove('hidden');
        childrenGroup.classList.remove('hidden');
    } else {
        spouseGroup.classList.add('hidden');
        childrenGroup.classList.add('hidden');
    }
}

// --- CORE CALCULATION LOGIC ---

function calculate() {
    const inputSalary = parseFloat(document.getElementById('salaryInput').value);
    
    if (isNaN(inputSalary) || inputSalary < 0) {
        // Use a nicer alert or just return
        return;
    }

    let result;

    if (currentMode === 'normal') {
        result = calculateNetFromGross(inputSalary);
    } else {
        result = calculateGrossFromNet(inputSalary);
    }

    displayResults(result);
}

function calculateNetFromGross(gross) {
    const maritalStatus = document.getElementById('maritalStatus').value;
    const spouseWorks = document.getElementById('spouseWorks').checked;
    const childrenCount = parseInt(document.getElementById('childrenCount').value) || 0;

    // 1. SS (9%)
    const ss = gross * 0.09;

    // 2. Taxable Income
    const taxableIncome = gross - ss;

    // 3. IRG
    const irg = calculateIRG(taxableIncome);

    // 4. Allocations
    let allocations = 0;
    if (maritalStatus === 'married') {
        if (!spouseWorks) allocations += 800; // Salary Unique
        if (childrenCount > 0) allocations += (childrenCount * 300);
    }

    // 5. Net
    const net = taxableIncome - irg + allocations;

    return {
        gross: gross,
        ss: ss,
        irg: irg,
        allocations: allocations,
        net: net
    };
}

function calculateIRG(income) {
    if (income <= 30000) return 0;

    let rawIRG = 0;
    
    // Scale 2022
    if (income > 30000) rawIRG += 4000; // Full 20% tranche (10k-30k)
    
    if (income <= 120000) {
        rawIRG += (income - 30000) * 0.30;
    } else {
        rawIRG += 27000; // Full 30% tranche (30k-120k)
        rawIRG += (income - 120000) * 0.35;
    }

    // 1st Abatement (40%, min 1000, max 1500)
    let ab1 = rawIRG * 0.40;
    if (ab1 < 1000) ab1 = 1000;
    if (ab1 > 1500) ab1 = 1500;
    
    let irg = rawIRG - ab1;
    if (irg < 0) irg = 0;

    // 2nd Abatement (Conditional)
    if (income > 30000 && income <= 35000) {
        irg = (irg * (137/51)) - (27925/8);
    }

    return Math.max(0, irg);
}

// --- REVERSE CALCULATION (Binary Search) ---
function calculateGrossFromNet(targetNet) {
    let low = targetNet;
    let high = targetNet * 2; // Initial guess upper bound
    let mid = 0;
    let calculatedNet = 0;
    let iterations = 0;

    // Expand high if needed
    while (calculateNetFromGross(high).net < targetNet) {
        high *= 2;
        if (high > 100000000) break; 
    }

    // Binary Search
    while (low <= high && iterations < 50) {
        mid = (low + high) / 2;
        const res = calculateNetFromGross(mid);
        calculatedNet = res.net;

        if (Math.abs(calculatedNet - targetNet) < 1) {
            return res; 
        }

        if (calculatedNet < targetNet) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
        iterations++;
    }

    return calculateNetFromGross(mid); 
}

// --- DISPLAY & CHART ---
function displayResults(data) {
    const resultCard = document.getElementById('resultCard');
    resultCard.classList.remove('hidden');
    
    // Scroll to results on mobile
    if(window.innerWidth < 768) {
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Animate Numbers
    animateValue("finalResult", 0, data.net, 1000);
    
    document.getElementById('resGross').innerText = formatCurrency(data.gross);
    document.getElementById('resSS').innerText = formatCurrency(data.ss);
    document.getElementById('resIRG').innerText = formatCurrency(data.irg);
    document.getElementById('resAlloc').innerText = formatCurrency(data.allocations);

    // Chart Update
    updateChart(data);
}

function formatCurrency(num) {
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.innerHTML = value.toLocaleString('fr-FR'); // Format with spaces
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function updateChart(data) {
    const ctx = document.getElementById('salaryChart').getContext('2d');
    
    if (myChart) {
        myChart.destroy();
    }

    // Determine colors based on theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e0e0e0' : '#333333';

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                translations[currentLang].labelFinalSalary, 
                translations[currentLang].labelSS, 
                translations[currentLang].labelIRG
            ],
            datasets: [{
                data: [data.net, data.ss, data.irg],
                backgroundColor: ['#00c853', '#ff3d00', '#2979ff'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: {
                            family: 'Inter',
                            size: 14
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                    titleColor: isDark ? '#000' : '#fff',
                    bodyColor: isDark ? '#000' : '#fff',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

// --- PDF GENERATION ---
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Simple Payslip Layout
    doc.setFontSize(22);
    doc.setTextColor(0, 135, 68);
    doc.text("Bulletin de Paie (Simulation)", 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Date: " + new Date().toLocaleDateString(), 20, 30);
    
    // Draw Line
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);
    
    // Data
    const gross = document.getElementById('resGross').innerText;
    const ss = document.getElementById('resSS').innerText;
    const irg = document.getElementById('resIRG').innerText;
    const net = document.getElementById('finalResult').innerText;

    let y = 50;
    doc.text(`Salaire Brut Imposable: ${gross} DA`, 20, y); y += 10;
    doc.text(`Retenue SS (9%): -${ss} DA`, 20, y); y += 10;
    doc.text(`Retenue IRG: -${irg} DA`, 20, y); y += 15;
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`NET A PAYER: ${net} DA`, 20, y);

    doc.save("bulletin-paie-algerie.pdf");
}
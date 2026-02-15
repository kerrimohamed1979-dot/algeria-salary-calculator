document.getElementById('maritalStatus').addEventListener('change', function() {
    const status = this.value;
    const spouseGroup = document.getElementById('spouseGroup');
    const childrenGroup = document.getElementById('childrenGroup');

    if (status === 'married') {
        spouseGroup.classList.remove('hidden');
        childrenGroup.classList.remove('hidden');
    } else {
        spouseGroup.classList.add('hidden');
        childrenGroup.classList.add('hidden');
        // Reset values if hidden
        document.getElementById('spouseWorks').checked = false;
        document.getElementById('childrenCount').value = 0;
    }
});

function calculateSalary() {
    // 1. Get Inputs
    const grossSalary = parseFloat(document.getElementById('baseSalary').value);
    const maritalStatus = document.getElementById('maritalStatus').value;
    const spouseWorks = document.getElementById('spouseWorks').checked;
    const childrenCount = parseInt(document.getElementById('childrenCount').value) || 0;

    if (isNaN(grossSalary) || grossSalary < 0) {
        alert("Veuillez entrer un salaire valide.");
        return;
    }

    // 2. Calculate Social Security (CNAS) - 9%
    const cnas = grossSalary * 0.09;
    
    // 3. Calculate Taxable Income (Salaire Imposable)
    const taxableIncome = grossSalary - cnas;

    // 4. Calculate IRG (Impôt sur le Revenu Global)
    let irg = calculateIRG(taxableIncome);

    // 5. Calculate Allocations (Family & Spouse)
    // Note: This is an estimation. Real value depends on specific social security rules.
    // Standard estimation: 300 DA per child.
    // Salaire Unique (Non-working spouse): ~800 DA.
    let allocations = 0;
    
    if (maritalStatus === 'married') {
        if (!spouseWorks) {
            allocations += 800; // Allocation Salaire Unique (ASU)
        }
        if (childrenCount > 0) {
            allocations += (childrenCount * 300); // Allocation Familiale standard
        }
    }

    // 6. Calculate Net Salary
    const netSalary = taxableIncome - irg + allocations;

    // 7. Display Results
    document.getElementById('ssValue').innerText = cnas.toFixed(2);
    document.getElementById('taxableIncome').innerText = taxableIncome.toFixed(2);
    document.getElementById('irgValue').innerText = irg.toFixed(2);
    document.getElementById('allocationsValue').innerText = allocations.toFixed(2);
    document.getElementById('netSalary').innerText = netSalary.toFixed(2);

    // Show result section
    document.getElementById('resultSection').classList.remove('hidden');
}

/**
 * Calculates IRG based on the 2022/2025 Scale
 * @param {number} income - Taxable Monthly Income
 * @returns {number} - The calculated tax
 */
function calculateIRG(income) {
    // Rule 1: Income <= 30,000 DA is Tax Free
    if (income <= 30000) {
        return 0;
    }

    // Rule 2: Calculate Raw IRG (IRG Brut) based on progressive scale
    // Scale:
    // 0 - 10,000: 0%
    // 10,001 - 30,000: 20%
    // 30,001 - 120,000: 30%
    // > 120,000: 35%
    
    let rawIRG = 0;

    // Tranche 1: 0 - 10,000 (0%)
    
    // Tranche 2: 10,001 - 30,000 (20%)
    // Full tranche is 20,000. 20% of 20,000 is 4,000.
    if (income > 30000) {
        rawIRG += 4000; // We know it's > 30k, so we take the full 4k from the 10-30k bracket
    } 
    
    // Tranche 3: 30,001 - 120,000 (30%)
    if (income <= 120000) {
        rawIRG += (income - 30000) * 0.30;
    } else {
        // Full tranche is 90,000. 30% of 90,000 is 27,000.
        rawIRG += 27000;
        
        // Tranche 4: > 120,000 (35%)
        rawIRG += (income - 120000) * 0.35;
    }

    // Rule 3: 1st Abatement (40%)
    // Min 1000, Max 1500
    let abatement1 = rawIRG * 0.40;
    if (abatement1 < 1000) abatement1 = 1000;
    if (abatement1 > 1500) abatement1 = 1500;

    // Apply 1st abatement
    let irgAfterAbatement1 = rawIRG - abatement1;
    if (irgAfterAbatement1 < 0) irgAfterAbatement1 = 0; // Should not happen given the logic but safe check

    // Rule 4: 2nd Abatement (For incomes between 30,001 and 35,000)
    let finalIRG = irgAfterAbatement1;

    if (income > 30000 && income <= 35000) {
        // Formula: IRG = (IRG1 * (137/51)) - (27925/8)
        finalIRG = (irgAfterAbatement1 * (137/51)) - (27925/8);
    }

    // Ensure no negative tax
    return Math.max(0, finalIRG);
}
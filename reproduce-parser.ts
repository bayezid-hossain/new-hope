const inputText = `Dear sir,  
Feed order date: 26 Jan 25
Feed delivery  date: 27 Jan 25

Farm No 1
Farmer: Rabby Trders
Location: Kazirshimla, Boilor
Phn: 01719608073
B2: 15 Bags

Farm No 02 
Farmer: Abdul Hamid
Location: Chamihadi, Bhaluka
Phn: 01608079722
B2: 15 Bags
`;


// Test Match
//conosle.log("\n--- Testing Regex Match ---");
const matchRegex = /Farm No[\s\S]*?(?=(?:Farm No)|$)/gi;
const matches = inputText.match(matchRegex);

if (matches) {
    //conosle.log(`Matches found: ${matches.length}`);
    matches.forEach((m, i) => {
        const lines = m.split('\n').map(l => l.trim()).filter(l => l);
        //conosle.log(`[${i}] Lines: ${lines.length}, First: "${lines[0]}", Second: "${lines[1] || 'NONE'}"`);
    });
} else {
    //conosle.log("No matches found.");
}


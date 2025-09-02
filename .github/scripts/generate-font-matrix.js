#!/usr/bin/env node

// Production build matrix - generates family-based build targets for CI/CD
const fs = require('fs');
const toml = require('@iarna/toml');

function generateFontMatrix(buildMode = 'complete') {
    try {
        const buildPlansContent = fs.readFileSync('private-build-plans.toml', 'utf8');
        const buildPlans = toml.parse(buildPlansContent);

        const familyTargets = [];
        let familyFilter = null;

        // Configure build mode
        switch (buildMode) {
            case 'quick':
                // Quick build: Core families only
                familyFilter = ['OtoshiMono', 'OtoshiTerm'];
                console.log('Build mode: Quick (core families only)');
                break;
            
            case 'single-family':
                // Single family build: OtoshiMono only
                familyFilter = ['OtoshiMono'];
                console.log('Build mode: Single Family (OtoshiMono only)');
                break;
            
            case 'complete':
            default:
                // Complete build: All families
                console.log('Build mode: Complete (all families)');
                break;
        }

        // Process each font family from build plans
        for (const [familyName, familyConfig] of Object.entries(buildPlans.buildPlans || {})) {
            // Apply family filter if specified
            if (familyFilter && !familyFilter.includes(familyName)) {
                continue;
            }

            familyTargets.push({
                family: familyName,
                baseTarget: familyName,
                targets: {
                    unhinted: `ttf-unhinted::${familyName}`,
                    hinted: `ttf::${familyName}`,
                    woff2: `woff2::${familyName}`,
                    webfont: `webfont::${familyName}`,
                    complete: `contents::${familyName}`
                },
                description: `${familyName} font family`
            });
        }

        console.log(`Font build: ${familyTargets.length} families scheduled`);

        // Create build batches for parallel execution
        const maxBatches = Math.min(8, Math.max(1, familyTargets.length));
        const batchSize = Math.ceil(familyTargets.length / maxBatches);
        const batches = [];

        for (let i = 0; i < familyTargets.length; i += batchSize) {
            batches.push({
                batchId: Math.floor(i / batchSize) + 1,
                families: familyTargets.slice(i, i + batchSize)
            });
        }

        console.log(`Parallel execution: ${batches.length} batch(es) with ${batchSize} family per batch`);

        const families = familyTargets.map(f => f.family);
        console.log(`families=${JSON.stringify(families)}`);
        console.log(`batches=${JSON.stringify(batches.map(b => b.batchId))}`);

        // Write build configuration files
        fs.writeFileSync('font-batches.json', JSON.stringify(batches, null, 2));
        fs.writeFileSync('font-matrix.json', JSON.stringify(familyTargets, null, 2));

        return { families, batches: batches.map(b => b.batchId), familyTargets, batches };

    } catch (error) {
        console.error('Matrix generation failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    const buildMode = process.argv[2] || 'complete';
    generateFontMatrix(buildMode);
}

module.exports = { generateFontMatrix };

#!/usr/bin/env node

// Test version - builds configurable subset of fonts
const fs = require('fs');
const toml = require('@iarna/toml');

function generateTestMatrix(testType = 'quick') {
    try {
        const buildPlansContent = fs.readFileSync('private-build-plans.toml', 'utf8');
        const buildPlans = toml.parse(buildPlansContent);

        // Read default build plans to get full weights and slopes
        const defaultPlansContent = fs.readFileSync('build-plans.toml', 'utf8');
        const defaultPlans = toml.parse(defaultPlansContent);

        const fullWeights = {
            'Thin': { shape: 100, menu: 1, css: 'thin' },
            'ExtraLight': { shape: 200, menu: 2, css: 'extra-light' },
            'Light': { shape: 300, menu: 3, css: 'light' },
            'Regular': { shape: 400, menu: 4, css: 'normal' },
            'Medium': { shape: 500, menu: 5, css: 'medium' },
            'SemiBold': { shape: 600, menu: 6, css: 'semi-bold' },
            'Bold': { shape: 700, menu: 7, css: 'bold' },
            'ExtraBold': { shape: 800, menu: 8, css: 'extra-bold' },
            'Heavy': { shape: 900, menu: 9, css: 'heavy' }
        };

        const fullSlopes = {
            'Upright': { angle: 0, shape: 'upright', css: 'normal' },
            'Italic': { angle: 9.4, shape: 'italic', css: 'italic' },
            'Oblique': { angle: 9.4, shape: 'oblique', css: 'oblique' }
        };

        const fontMatrix = [];
        let familyFilter = null;
        let widthFilter = null;
        let weightFilter = null;
        let slopeFilter = null;

        // Configure test type
        switch (testType) {
            case 'quick':
                // Quick test: Only Regular/Upright fonts
                weightFilter = { 'Regular': fullWeights.Regular };
                slopeFilter = { 'Upright': fullSlopes.Upright };
                console.log('Test mode: Quick (Regular/Upright only)');
                break;

            case 'single-family':
                // Single family: OtoshiMono only, all variants
                familyFilter = ['OtoshiMono'];
                console.log('Test mode: Single Family (OtoshiMono only, all variants)');
                break;

            case 'single-width':
                // Single width: Normal width only, both families, all weights/slopes
                widthFilter = ['Normal'];
                console.log('Test mode: Single Width (Normal width only, all weights/slopes)');
                break;

            default:
                console.log('Test mode: Default (quick)');
                weightFilter = { 'Regular': fullWeights.Regular };
                slopeFilter = { 'Upright': fullSlopes.Upright };
        }

        // Process each font family
        for (const [familyName, familyConfig] of Object.entries(buildPlans.buildPlans || {})) {
            // Apply family filter
            if (familyFilter && !familyFilter.includes(familyName)) {
                continue;
            }

            const weights = weightFilter || familyConfig.weights || fullWeights;
            const slopes = slopeFilter || familyConfig.slopes || fullSlopes;
            const allWidths = familyConfig.widths || { 'Normal': { shape: 500, menu: 5, css: 'normal' } };

            // Apply width filter
            const widths = widthFilter ?
                Object.fromEntries(Object.entries(allWidths).filter(([name]) => widthFilter.includes(name))) :
                allWidths;

            for (const [widthName, widthConfig] of Object.entries(widths)) {
                for (const [weightName, weightConfig] of Object.entries(weights)) {
                    for (const [slopeName, slopeConfig] of Object.entries(slopes)) {
                        let fileName = familyName;
                        if (widthName !== 'Normal') fileName += `-${widthName}`;
                        if (weightName !== 'Regular') fileName += `-${weightName}`;
                        if (slopeName !== 'Upright') fileName += `-${slopeName}`;

                        fontMatrix.push({
                            family: familyName,
                            fileName: fileName,
                            width: widthName,
                            weight: weightName,
                            slope: slopeName,
                            target: `ttf::${familyName}/${fileName}`
                        });
                    }
                }
            }
        }

        console.log(`Test build: ${fontMatrix.length} fonts`);

        // Create reasonable batches for testing (max 5 parallel jobs)
        const maxBatches = Math.min(5, fontMatrix.length);
        const batchSize = Math.ceil(fontMatrix.length / maxBatches);
        const batches = [];

        for (let i = 0; i < fontMatrix.length; i += batchSize) {
            batches.push({
                batchId: Math.floor(i / batchSize) + 1,
                fonts: fontMatrix.slice(i, i + batchSize)
            });
        }

        console.log(`Batching into ${batches.length} parallel jobs with ~${batchSize} fonts each`);

        const families = [...new Set(fontMatrix.map(f => f.family))];
        console.log(`families=${JSON.stringify(families)}`);
        console.log(`batches=${JSON.stringify(batches.map(b => b.batchId))}`);

        fs.writeFileSync('.github/font-batches.json', JSON.stringify(batches, null, 2));
        fs.writeFileSync('.github/font-matrix.json', JSON.stringify(fontMatrix, null, 2));

        return { families, batches: batches.map(b => b.batchId), fontMatrix, batches };

    } catch (error) {
        console.error('Error generating test matrix:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    const testType = process.argv[2] || 'quick';
    generateTestMatrix(testType);
}

module.exports = { generateTestMatrix };

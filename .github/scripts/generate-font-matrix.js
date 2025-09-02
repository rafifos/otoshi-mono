#!/usr/bin/env node

const fs = require('fs');
const toml = require('@iarna/toml');

function generateFontMatrix() {
    try {
        // Read the private build plans
        const buildPlansContent = fs.readFileSync('private-build-plans.toml', 'utf8');
        const buildPlans = toml.parse(buildPlansContent);

        // Read default build plans to get default weights and slopes
        const defaultPlansContent = fs.readFileSync('build-plans.toml', 'utf8');
        const defaultPlans = toml.parse(defaultPlansContent);

        // Get default weights and slopes from Iosevka plan or define them
        const defaultWeights = defaultPlans.buildPlans?.Iosevka?.weights || {
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

        const defaultSlopes = defaultPlans.buildPlans?.Iosevka?.slopes || {
            'Upright': { angle: 0, shape: 'upright', css: 'normal' },
            'Italic': { angle: 9.4, shape: 'italic', css: 'italic' },
            'Oblique': { angle: 9.4, shape: 'oblique', css: 'oblique' }
        };

        const fontMatrix = [];
        const familyGroups = {};

        // Process each font family in our custom build plans
        for (const [familyName, familyConfig] of Object.entries(buildPlans.buildPlans || {})) {
            const weights = familyConfig.weights || defaultWeights;
            const slopes = familyConfig.slopes || defaultSlopes;
            const widths = familyConfig.widths || { 'Normal': { shape: 500, menu: 5, css: 'normal' } };

            familyGroups[familyName] = {
                widthCount: Object.keys(widths).length,
                weightCount: Object.keys(weights).length,
                slopeCount: Object.keys(slopes).length,
                totalFonts: Object.keys(widths).length * Object.keys(weights).length * Object.keys(slopes).length
            };

            // Generate individual font entries
            for (const [widthName, widthConfig] of Object.entries(widths)) {
                for (const [weightName, weightConfig] of Object.entries(weights)) {
                    for (const [slopeName, slopeConfig] of Object.entries(slopes)) {
                        // Generate the font file name based on the pattern used by Iosevka
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

        console.log('Font Family Summary:');
        for (const [family, info] of Object.entries(familyGroups)) {
            console.log(`${family}: ${info.widthCount} widths × ${info.weightCount} weights × ${info.slopeCount} slopes = ${info.totalFonts} fonts`);
        }
        console.log(`\nTotal fonts to build: ${fontMatrix.length}`);

        // Split fonts into batches for parallel processing
        const batchSize = Math.ceil(fontMatrix.length / 20); // Target ~20 parallel jobs max
        const batches = [];
        for (let i = 0; i < fontMatrix.length; i += batchSize) {
            batches.push({
                batchId: Math.floor(i / batchSize) + 1,
                fonts: fontMatrix.slice(i, i + batchSize)
            });
        }

        console.log(`\nBatching into ${batches.length} parallel jobs with ~${batchSize} fonts each`);

        // Output for GitHub Actions
        console.log('\n=== GITHUB ACTIONS OUTPUT ===');

        // Output font families for family-level caching
        const families = [...new Set(fontMatrix.map(f => f.family))];
        console.log(`families=${JSON.stringify(families)}`);

        // Output batches for parallel building
        console.log(`batches=${JSON.stringify(batches.map(b => b.batchId))}`);

        // Write detailed batch information to files
        try {
            if (!fs.existsSync('.github')) {
                fs.mkdirSync('.github', { recursive: true });
            }
            fs.writeFileSync('.github/font-batches.json', JSON.stringify(batches, null, 2));
            fs.writeFileSync('.github/font-matrix.json', JSON.stringify(fontMatrix, null, 2));
            console.log('\nBatch details written to .github/font-batches.json');
            console.log('Full matrix written to .github/font-matrix.json');
        } catch (githubDirError) {
            console.log('\nFailed to write to .github directory, writing to current directory');
            fs.writeFileSync('font-batches.json', JSON.stringify(batches, null, 2));
            fs.writeFileSync('font-matrix.json', JSON.stringify(fontMatrix, null, 2));
            console.log('Batch details written to font-batches.json');
            console.log('Full matrix written to font-matrix.json');
        }

        return { families, batches: batches.map(b => b.batchId), fontMatrix, batches: batches };

    } catch (error) {
        console.error('Error generating font matrix:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    generateFontMatrix();
}

module.exports = { generateFontMatrix };

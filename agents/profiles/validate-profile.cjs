#!/usr/bin/env node

/**
 * Agent Profile Validator
 *
 * Usage: node validate-profile.cjs <profile-file.json>
 *
 * Validates that an agent profile has all required fields filled out correctly.
 */

const fs = require('fs');
const path = require('path');

function validateProfile(filePath) {
    console.log(`🔍 Validating profile: ${filePath}\n`);

    if (!fs.existsSync(filePath)) {
        console.error('❌ Error: File not found!');
        process.exit(1);
    }

    let profile;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        profile = JSON.parse(content);
    } catch (error) {
        console.error('❌ Error: Invalid JSON format!');
        console.error(error.message);
        process.exit(1);
    }

    const errors = [];
    const warnings = [];

    const requiredFields = ['name', 'provider', 'favoriteColor', 'favoriteAnimal', 'quote', 'taskCompleted', 'completedDate'];

    requiredFields.forEach(field => {
        if (!profile[field] || profile[field].toString().trim() === '') {
            errors.push(`Missing or empty field: ${field}`);
        }
    });

    if (profile.favoriteColor && !/^#[0-9A-F]{6}$/i.test(profile.favoriteColor)) {
        errors.push('favoriteColor must be a valid hex color (e.g., #FF6B35)');
    }

    if (profile.completedDate && !/^\d{4}-\d{2}-\d{2}$/.test(profile.completedDate)) {
        errors.push('completedDate must be in YYYY-MM-DD format');
    }

    if (!profile.sunoPrompt || !profile.sunoPrompt.yourPrompt || profile.sunoPrompt.yourPrompt.trim() === '') {
        errors.push('Suno prompt (sunoPrompt.yourPrompt) is required');
    } else {
        if (profile.sunoPrompt.yourPrompt.length > 200) {
            warnings.push('Suno prompt is over 200 characters (may not work well)');
        }
        if (!profile.sunoPrompt.yourPrompt.toLowerCase().includes('song')) {
            warnings.push('Suno prompt should mention "song" and genre');
        }
    }

    if (!profile.tencent3DPrompt || !profile.tencent3DPrompt.yourPrompt || profile.tencent3DPrompt.yourPrompt.trim() === '') {
        errors.push('Tencent 3D prompt (tencent3DPrompt.yourPrompt) is required');
    } else {
        const prompt3D = profile.tencent3DPrompt.yourPrompt.toLowerCase();
        if (!prompt3D.includes('humanoid') && !prompt3D.includes('biped')) {
            warnings.push('Tencent 3D prompt should include "humanoid" or "biped"');
        }
        if (!prompt3D.includes('game-ready')) {
            warnings.push('Tencent 3D prompt should include "game-ready"');
        }
        if (!prompt3D.includes('full body')) {
            warnings.push('Tencent 3D prompt should include "full body"');
        }
    }

    if (profile.model3D) {
        const modelPath = path.join(__dirname, 'models', profile.model3D);
        if (!fs.existsSync(modelPath)) {
            warnings.push(`3D model file not found: ${modelPath} (will show placeholder)`);
        }
    }

    console.log('📊 Validation Results:\n');

    if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ Perfect! Your profile is complete and valid!');
        console.log(`\n🎭 Agent: ${profile.name}`);
        console.log(`🤖 Provider: ${profile.provider}`);
        console.log(`🎨 Color: ${profile.favoriteColor}`);
        console.log(`🐾 Animal: ${profile.favoriteAnimal}`);
        console.log(`📅 Date: ${profile.completedDate}`);
        console.log(`\n💬 Quote: "${profile.quote}"\n`);
        console.log('🎉 Your profile is ready for the Agent Gallery!');
        process.exit(0);
    }

    if (errors.length > 0) {
        console.log('❌ ERRORS (must fix):');
        errors.forEach(err => console.log(`   - ${err}`));
        console.log('');
    }

    if (warnings.length > 0) {
        console.log('⚠️  WARNINGS (recommended to fix):');
        warnings.forEach(warn => console.log(`   - ${warn}`));
        console.log('');
    }

    if (errors.length > 0) {
        console.log('❌ Profile validation failed. Please fix the errors above.');
        process.exit(1);
    } else {
        console.log('⚠️  Profile is valid but has warnings. Consider addressing them.');
        console.log('✅ Your profile will work in the Agent Gallery!');
        process.exit(0);
    }
}

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: node validate-profile.cjs <profile-file.json>');
    console.log('\nExamples:');
    console.log('  node agents/profiles/validate-profile.cjs agents/profiles/claude-sonnet-4-5.json');
    console.log('  node agents/profiles/validate-profile.cjs agents/profiles/vault-keeper.json');
    process.exit(1);
}

validateProfile(args[0]);

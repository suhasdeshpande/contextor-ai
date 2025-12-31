/**
 * Visual demonstration of the context management problem
 * 
 * Run with: bun run packages/context-manager/scripts/visualize-context-problem.ts
 * 
 * This shows:
 * 1. Without context management: tokens grow unbounded → failure
 * 2. With context management: tokens stay controlled → success
 */

const DELAY = 100; // ms between steps

// Simulate token growth without context management
function simulateWithoutCM(steps: number) {
    console.log('\n❌ WITHOUT Context Management:\n');
    console.log('Step | Tokens  | Status');
    console.log('-----|---------|------------------');
    
    let tokens = 1000;
    for (let i = 1; i <= steps; i++) {
        tokens += 2000 + (i * 500); // Faster growth to show failure clearly
        const status = tokens > 100000 ? '❌ FAILED (limit exceeded)' : 
                      tokens > 80000 ? '⚠️  WARNING (approaching limit)' : 
                      '✅ OK';
        console.log(`${String(i).padStart(4)} | ${String(tokens).padStart(7)} | ${status}`);
        
        if (tokens > 100000) {
            console.log(`\n💥 Agent failed at step ${i} - token limit exceeded!`);
            break;
        }
    }
}

// Simulate token growth with context management
function simulateWithCM(steps: number) {
    console.log('\n✅ WITH Context Management:\n');
    console.log('Step | Tokens  | Strategy Applied | Status');
    console.log('-----|---------|------------------|------------------');
    
    let tokens = 1000;
    for (let i = 1; i <= steps; i++) {
        tokens += Math.floor(Math.random() * 2000) + 1000; // Random growth
        
        let strategy = '';
        let reduction = 0;
        
        // Apply strategies based on thresholds
        if (tokens > 60000 && i >= 5) {
            // Offload
            reduction = Math.floor(tokens * 0.85);
            tokens = reduction;
            strategy = '💾 OFFLOAD';
        } else if (tokens > 50000 && i % 5 === 0) {
            // Summarize
            reduction = Math.floor(tokens * 0.75);
            tokens = reduction;
            strategy = '📝 SUMMARIZE';
        } else if (tokens > 40000 && i >= 3) {
            // Compact
            reduction = Math.floor(tokens * 0.60);
            tokens = reduction;
            strategy = '📦 COMPACT';
        } else if (tokens > 30000) {
            // Filter
            reduction = Math.floor(tokens * 0.75);
            tokens = reduction;
            strategy = '🔍 FILTER';
        }
        
        const status = tokens > 100000 ? '❌ FAILED' : 
                      tokens > 80000 ? '⚠️  WARNING' : 
                      '✅ OK';
        const strategyDisplay = strategy || '-';
        console.log(`${String(i).padStart(4)} | ${String(tokens).padStart(7)} | ${strategyDisplay.padEnd(17)} | ${status}`);
    }
    
    console.log(`\n🎉 Agent completed all ${steps} steps successfully!`);
}

// Main visualization
async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Context Management Problem Visualization');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const steps = 20;
    
    // Show problem
    simulateWithoutCM(steps);
    
    await new Promise(resolve => setTimeout(resolve, DELAY * 2));
    
    // Show solution
    simulateWithCM(steps);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Key Differences:');
    console.log('  ❌ Without CM: Tokens grow unbounded → failure at step ~15-20');
    console.log('  ✅ With CM: Strategies keep tokens controlled → completes all steps');
    console.log('\n💡 Context management strategies:');
    console.log('  🔍 Filter (30k+ tokens): Truncates messages');
    console.log('  📦 Compact (40k+ tokens): Replaces large outputs with references');
    console.log('  📝 Summarize (50k+ tokens, every 5 steps): Condenses old messages');
    console.log('  💾 Offload (60k+ tokens, after 5 steps): Moves to external storage');
    console.log('\n');
}

main().catch(console.error);


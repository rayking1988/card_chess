import { describe, it, expect } from 'vitest';
import { GameStateManager } from './GameStateManager';

describe('Debug Energy', () => {
  it('debug energy refill', () => {
    const manager = new GameStateManager('white', 'Test White', 'Test Black');
    manager.startGame();

    console.log('Initial state:');
    console.log('  White energy:', manager.getEnergy('white'), 'cap:', manager.getEnergyCap('white'));
    console.log('  Black energy:', manager.getEnergy('black'), 'cap:', manager.getEnergyCap('black'));
    console.log('  Current turn:', manager.getCurrentTurn());

    // Set up energy caps
    manager.modifyEnergyCap('white', 8);
    manager.modifyEnergyCap('black', 6);

    console.log('\nAfter setting caps:');
    console.log('  White energy:', manager.getEnergy('white'), 'cap:', manager.getEnergyCap('white'));
    console.log('  Black energy:', manager.getEnergy('black'), 'cap:', manager.getEnergyCap('black'));

    // End white's turn
    manager.endTurn();

    console.log('\nAfter first endTurn (should be black\'s turn):');
    console.log('  Current turn:', manager.getCurrentTurn());
    console.log('  White energy:', manager.getEnergy('white'), 'cap:', manager.getEnergyCap('white'));
    console.log('  Black energy:', manager.getEnergy('black'), 'cap:', manager.getEnergyCap('black'));

    // The test expects black's energy to be 6 after endTurn
    expect(manager.getEnergy('black')).toBe(6);
  });
});

/**
 * @fileoverview Card effect resolution helpers
 *
 * @module managers/gameState/effects
 */

import type { Card, PlayerColor, CardEffectAction } from './types';
import { normalizeCardEffects } from './types';

/**
 * Dependencies required to resolve card effects
 */
export interface CardEffectContext {
  playEnergyCard(player: PlayerColor): boolean;
  shuffleDeck(player: PlayerColor): void;
  drawCards(player: PlayerColor, count: number, respectCap: boolean): number;
  discardToHandSize(player: PlayerColor): Card[];
  trackDeployedPiece(player: PlayerColor, square: string, notify?: boolean): void;
  modifyTime(player: PlayerColor, amount: number): void;
  modifyEnergy(player: PlayerColor, amount: number): boolean;
  modifyEnergyCap(player: PlayerColor, amount: number): void;
}

/**
 * Resolves a card's effect
 *
 * @param context - GameStateManager methods needed to apply effects
 * @param card - The card being played
 * @param player - The player who played the card
 * @param target - Optional target for targeted effects
 * @returns Object with success flag and message
 */
export function resolveCardEffect(
  context: CardEffectContext,
  card: Card,
  player: PlayerColor,
  target?: string | string[]
): { success: boolean; message: string } {
  const effects = normalizeCardEffects(card.effect);
  const targets = Array.isArray(target) ? target : (target ? [target] : []);
  let targetIndex = 0;
  const messages: string[] = [];

  const fail = (message: string): { success: boolean; message: string } => ({ success: false, message });
  const pushMessage = (message: string): void => {
    if (message) {
      messages.push(message);
    }
  };

  for (const effect of effects) {
    const result = resolveSingleEffect(context, effect, player, targets[targetIndex]);
    if (!result.success) {
      return result;
    }
    if ('requiresTarget' in effect && effect.requiresTarget) {
      targetIndex += 1;
    }
    pushMessage(result.message);
  }

  if (messages.length === 0) {
    return { success: true, message: 'Effect resolved' };
  }
  if (messages.length === 1) {
    return { success: true, message: messages[0] };
  }
  return { success: true, message: messages.join('; ') };
}

/**
 * Resolves a single card effect action.
 *
 * @param context - Effect resolution context.
 * @param effect - Effect action to resolve.
 * @param player - Player who triggered the effect.
 * @param target - Optional target square for targeted effects.
 * @returns Result object with success flag and message.
 */
function resolveSingleEffect(
  context: CardEffectContext,
  effect: CardEffectAction,
  player: PlayerColor,
  target?: string
): { success: boolean; message: string } {
  switch (effect.action) {
    case 'ENERGY_CARD': {
      const energySuccess = context.playEnergyCard(player);
      return {
        success: energySuccess,
        message: energySuccess ? 'Energy increased' : 'Energy card already played this turn'
      };
    }
    case 'SHUFFLE_DECK':
      context.shuffleDeck(player);
      return { success: true, message: 'Deck shuffled' };
    case 'DRAW_CARDS': {
      const drawn = context.drawCards(player, effect.count, effect.respectCap);
      return { success: true, message: `Drew ${drawn} card(s)` };
    }
    case 'DISCARD_TO_CAP': {
      const discarded = context.discardToHandSize(player);
      return { success: true, message: `Discarded ${discarded.length} card(s)` };
    }
    case 'DEPLOY_PIECE':
      if (!target) {
        return { success: false, message: 'No target square specified' };
      }
      context.trackDeployedPiece(player, target);
      return { success: true, message: `Deploy ${effect.piece} to ${target}` };
    case 'DESTROY_PIECE':
      if (!target) {
        return { success: false, message: 'No target square specified' };
      }
      return { success: true, message: `Destroy piece at ${target}` };
    case 'MODIFY_TIME':
      context.modifyTime(player, effect.amount);
      return {
        success: true,
        message: effect.amount >= 0 ? `Gained ${effect.amount}s` : `Lost ${Math.abs(effect.amount)}s`
      };
    case 'MODIFY_ENERGY': {
      const energyModSuccess = context.modifyEnergy(player, effect.amount);
      return {
        success: energyModSuccess,
        message: effect.amount >= 0 ? `Gained ${effect.amount} energy` : `Lost ${Math.abs(effect.amount)} energy`
      };
    }
    case 'MODIFY_ENERGY_CAP':
      context.modifyEnergyCap(player, effect.amount);
      return {
        success: true,
        message: effect.amount >= 0
          ? `Energy cap increased by ${effect.amount}`
          : `Energy cap decreased by ${Math.abs(effect.amount)}`
      };
    default:
      return { success: false, message: 'Unknown effect' };
  }
}

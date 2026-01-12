/**
 * @fileoverview Network message serialization helpers
 *
 * @module managers/network/serialization
 */

import type { GameAction, JsonValue, NetworkMessage } from './types';

/**
 * Serializes a GameAction to NetworkMessage for transmission
 *
 * @param action - The game action to serialize
 * @returns NetworkMessage ready for transmission
 */
export function serializeAction(action: GameAction): NetworkMessage {
  return {
    actionType: action.type,
    payload: JSON.parse(JSON.stringify(action)) as JsonValue
  };
}

/**
 * Deserializes a NetworkMessage back to GameAction
 *
 * @param message - The received network message
 * @returns GameAction or null if deserialization fails
 */
export function deserializeAction(message: NetworkMessage): GameAction | null {
  try {
    return message.payload as unknown as GameAction;
  } catch {
    console.error('Failed to deserialize action:', message);
    return null;
  }
}

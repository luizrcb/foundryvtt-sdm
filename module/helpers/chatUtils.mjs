export function getActorFromMessage(message, user) {
  // Method 1: Direct actor reference (for newer Foundry versions)
  if (message.actor) return message.actor;

  // Method 2: From speaker data (for older versions)
  if (message.speaker?.actor) {
    return game.actors.get(message.speaker.actor);
  }

  // Method 3: From token (for combat rolls)
  if (message.speaker?.token) {
    const token = canvas.tokens.get(message.speaker.token);
    return token?.actor;
  }

  // Method 4: Try to find actor by name (last resort)
  if (message.speaker?.alias) {
    return game.actors.find(a => a.name === message.speaker.alias);
  }

  if (user?.character) {
    return user.character;
  }

  console.warn("Could not determine actor for message:", message);
  return null;
}
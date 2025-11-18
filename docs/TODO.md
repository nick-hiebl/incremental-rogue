# Outline

This game is intended as a lightly "story-based" incremental game.

The player is presented with several branching choices in terms of how they intend to run their organisation, which results in different paths becoming available. For example different resources, objectives, and producers will be available to players depending on the path they select.

## Major uncompleted objectives

- **Act System:** Selecting a choice can result in the game refreshing with entirely new resources, producers, etc.
- **The Story:** Bulky "content" piece of the game. Different branching paths and organisation types implemented, along with characters who provide quests and interactions and consequences for quests.

## More fine-grained tasks to be implemented

- The ability to defer completing quests (in case they want to decide later).
- Quests with an arbitrary number of options available.
- Quest options can have requirements, making those options locked unless those requirements are met.
- Breakdown of what parts of game state are specific to the current act, and which belong to the overall run (facilitating the act system).
- Action available on a quest option which allows moving the game to a new act.
- Game state persists to local storage.

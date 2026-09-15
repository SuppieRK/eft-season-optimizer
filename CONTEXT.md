# Battle Pass optimization

The optimizer helps players plan document farming and track Battle Pass rewards.

## Language

**Reward requirement**:
A regular-document type and quantity needed to claim a Battle Pass reward.
_Avoid_: Price, owned quantity

**Default requirements**:
The reward requirements supplied with the optimizer. They do not necessarily match every player's requirements.
_Avoid_: Universal requirements

**Personal requirements**:
The reward requirements a player records for their own Battle Pass, with defaults for rewards they did not customize.
_Avoid_: Custom rewards

**Player progress**:
The player's recorded owned documents and claimed rewards. Progress is distinct from reward requirements.
_Avoid_: Requirements

**Complete backup**:
An export of every reward's requirements, player progress, and saved preferences at a specific time for later restoration.
_Avoid_: Requirements-only export

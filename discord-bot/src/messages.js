// Discord message "component type" numbers used by Components v2 messages
// (the newer container/text-display format, distinct from embeds).
const COMPONENT_TYPE = {
  CONTAINER: 17,
  TEXT_DISPLAY: 10,
  SEPARATOR: 14,
};

const EARTH_EMOJI = '<:Earth:1528517539070476479>';
const CITIZEN_ROLE = '<@&1493722878275747962>';
const PRIVATE_ROLE = '<@&1493722852653011094>';
const COHOST_ROLES = '<@&1493722760118145034> <@&1493722349273485424>';
const CONTAINER_ACCENT_COLOR = 1795875; // RGB(27, 103, 35)

function textDisplay(content) {
  return { type: COMPONENT_TYPE.TEXT_DISPLAY, content };
}

function separator(spacing = 2) {
  return { type: COMPONENT_TYPE.SEPARATOR, divider: true, spacing };
}

function container(components, accentColor = CONTAINER_ACCENT_COLOR) {
  return {
    type: COMPONENT_TYPE.CONTAINER,
    accent_color: accentColor,
    spoiler: false,
    components,
  };
}

/**
 * Discord's relative auto-updating timestamp format, e.g. "in 35 minutes",
 * which live-counts down in the Discord client.
 */
function relativeTimestamp(date) {
  const unixSeconds = Math.floor(date.getTime() / 1000);
  return `<t:${unixSeconds}:R>`;
}

const EXAM_LABELS = {
  slot_1: { title: ':rock: | Citizen \u27a4 Private', description: 'Answer a series of questions to the best of your ability.' },
  slot_2: { title: ':mountain: | Private \u27a4 Soldier', description: 'Fight another private in a 1v1. Best out of 3 passes.' },
};

/**
 * Builds the Double Exam poll message, matching the Components v2 format
 * given for this event type. hostDiscordId is optional (mentioned once
 * known); coHostRoleLabel is the eligible co-host rank text shown under each
 * exam (e.g. "Corporal Sergeant").
 */
export function buildDoubleExamPollMessage({ scheduledFor, hostDiscordId, coHostRoleLabel, slots = [] }) {
  const hostLine = hostDiscordId ? `Host: <@${hostDiscordId}>` : 'Host: ';
  const coHostLine = (slotIndex) => {
    const claimed = slots.find((sl) => sl.slot_index === slotIndex)?.claimed_by_discord_id;
    return `Co-Host: ${claimed ? `<@${claimed}>` : COHOST_ROLES}`;
  };

  return {
    components: [
      container([
        textDisplay(`# ${EARTH_EMOJI} **__Earth Exam poll__** ${EARTH_EMOJI}`),
        textDisplay(`### Please vote which exam you would like hosted ${relativeTimestamp(scheduledFor)}`),
        textDisplay(hostLine),
        separator(),
        textDisplay(`### ${EXAM_LABELS.slot_1.title}`),
        textDisplay(`\`\`\`${EXAM_LABELS.slot_1.description}\`\`\``),
        textDisplay(coHostLine(1)),
        separator(),
        textDisplay(`### ${EXAM_LABELS.slot_2.title}`),
        textDisplay(`\`\`\`${EXAM_LABELS.slot_2.description}\`\`\``),
        textDisplay(coHostLine(2)),
        separator(),
        textDisplay('```\nOnly vote if you\'re off cooldown and able to attend\n2 warnings = dismissal\n```'),
      ]),
    ],
  };
}

function button(label, customId, disabled = false) {
  return { type: 1, components: [{ type: 2, style: 3, label, custom_id: customId, disabled }] };
}

/** Components V2 co-host request layout for Double Exam. */
export function buildDoubleExamCoHostMessage({ eventId, hostDiscordId, slots = [] }) {
  const getSlot = (index) => slots.find((slot) => slot.slot_index === index);
  const slot1 = getSlot(1);
  const slot2 = getSlot(2);
  const coHostLine = (slot) => slot?.claimed_by_discord_id
    ? '<@' + slot.claimed_by_discord_id + '>'
    : 'Unclaimed';
  const coHostButton = (slot, index) => slot?.claimed_by_discord_id
    ? button('Unclaim', 'cohost_unclaim:' + eventId + ':' + index)
    : button('Claim', 'cohost_claim:' + eventId + ':' + index);

  return {
    components: [container([
      textDisplay('# :Earth: **__Double Exam Request__** :Earth:'),
      textDisplay('Host: ' + (hostDiscordId ? '<@' + hostDiscordId + '>' : 'Host unavailable')),
      separator(2),
      textDisplay(`### :rock: | ${CITIZEN_ROLE} ➤ Private`),
      textDisplay('Claimed by: ' + coHostLine(slot1)),
      coHostButton(slot1, 1),
      separator(2),
      textDisplay(`### :mountain: | ${PRIVATE_ROLE} ➤ Soldier`),
      textDisplay('Claimed by: ' + coHostLine(slot2)),
      coHostButton(slot2, 2),
    ])],
  };
}

/** Components V2 conclusion layout for Double Exam. */
export function buildDoubleExamConclusionMessage({
  hostDiscordId,
  slot1Enabled,
  slot2Enabled,
  slot1Passed = [],
  slot2Passed = [],
  slot1Cohost,
  slot2Cohost,
  guards = [],
  spectators = [],
}) {
  const mentionList = (ids) => ids.length ? ids.map((id) => '<@' + id + '>').join(', ') : 'None';
  const components = [
    textDisplay(`## ${EARTH_EMOJI} **__Double Exam Concluded__** ${EARTH_EMOJI}`),
    textDisplay('Host: ' + (hostDiscordId ? '<@' + hostDiscordId + '>' : 'Host unavailable')),
    separator(2),
  ];
  if (slot1Enabled) {
    components.push(
      textDisplay('### Private Exam'),
      textDisplay('Congratulations ' + mentionList(slot1Passed) + ' on passing their exam '),
      textDisplay('Co-Host ' + (slot1Cohost ? '<@' + slot1Cohost + '>' : 'None')),
      separator(2),
    );
  }
  if (slot2Enabled) {
    components.push(
      textDisplay('### Solder Exam'),
      textDisplay('Congratulations ' + mentionList(slot2Passed) + ' on passing their exam '),
      textDisplay('Co-Host ' + (slot2Cohost ? '<@' + slot2Cohost + '>' : 'None')),
      separator(2),
    );
  }
  components.push(
    textDisplay('Guards ' + mentionList(guards)),
    textDisplay('Spectators ' + mentionList(spectators)),
    textDisplay('### Glory to the Kingdom!'),
  );
  return { components: [container(components)] };
}

export { relativeTimestamp, EXAM_LABELS };

export const IS_COMPONENTS_V2 = 1 << 15;

export function buildStartMessage({ hostDiscordId, activities }) {
  const host = `<@${hostDiscordId}>`;
  if (activities.slot_1 && activities.slot_2) {
    return `${CITIZEN_ROLE} ${PRIVATE_ROLE} Exam is starting. DM ${host} for the link`;
  }
  if (activities.slot_1) {
    return `${CITIZEN_ROLE} Exam is starting. DM ${host} for the link`;
  }
  return `${PRIVATE_ROLE} Exam is starting. DM ${host} for the link`;
}

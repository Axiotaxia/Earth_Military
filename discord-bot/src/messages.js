// Discord message "component type" numbers used by Components v2 messages
// (the newer container/text-display format, distinct from embeds).
const COMPONENT_TYPE = {
  CONTAINER: 17,
  TEXT_DISPLAY: 10,
  SEPARATOR: 14,
};

const EARTH_EMOJI = '<:Earth:1528517539070476479>';
const CONTAINER_ACCENT_COLOR = 1795874; // matches the color used in the provided format

function textDisplay(content) {
  return { type: COMPONENT_TYPE.TEXT_DISPLAY, content };
}

function separator() {
  return { type: COMPONENT_TYPE.SEPARATOR, divider: true, spacing: 2 };
}

function container(components) {
  return {
    type: COMPONENT_TYPE.CONTAINER,
    accent_color: CONTAINER_ACCENT_COLOR,
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
export function buildDoubleExamPollMessage({ scheduledFor, hostDiscordId, coHostRoleLabel }) {
  const hostLine = hostDiscordId ? `Host: <@${hostDiscordId}>` : 'Host: ';

  return {
    components: [
      container([
        textDisplay(`# ${EARTH_EMOJI} **__Earth Exam poll__** ${EARTH_EMOJI}`),
        textDisplay(`### Please vote which exam you would like hosted ${relativeTimestamp(scheduledFor)}`),
        textDisplay(hostLine),
        separator(),
        textDisplay(`### ${EXAM_LABELS.slot_1.title}`),
        textDisplay(`\`\`\`${EXAM_LABELS.slot_1.description}\`\`\``),
        textDisplay(`Co-Host: ${coHostRoleLabel}`),
        separator(),
        textDisplay(`### ${EXAM_LABELS.slot_2.title}`),
        textDisplay(`\`\`\`${EXAM_LABELS.slot_2.description}\`\`\``),
        textDisplay(`Co-Host: ${coHostRoleLabel}`),
        separator(),
        textDisplay('```\nOnly vote if you\'re off cooldown and able to attend\n2 warnings = dismissal\n```'),
      ]),
    ],
  };
}

export { relativeTimestamp, EXAM_LABELS };

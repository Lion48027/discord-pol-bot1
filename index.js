require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error("DISCORD_TOKEN, CLIENT_ID oder GUILD_ID fehlt.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const ACTIONS = {
  uprank: {
    label: "Uprank",
    color: 0x2ecc71,
    title: "Uprank eintragen"
  },
  downrank: {
    label: "Downrank",
    color: 0xe67e22,
    title: "Downrank eintragen"
  },
  sanktion: {
    label: "Sanktion",
    color: 0xe74c3c,
    title: "Sanktion eintragen"
  }
};

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("pol")
      .setDescription("Öffnet das POL Menü")
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("/pol wurde registriert");
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot online als ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "pol") {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({
          content: "Du brauchst `Server verwalten`, um das zu benutzen.",
          ephemeral: true
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pol_uprank")
          .setLabel("Uprank")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("pol_downrank")
          .setLabel("Downrank")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("pol_sanktion")
          .setLabel("Sanktion")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        content: "Wähle eine Aktion aus:",
        components: [row],
        ephemeral: true
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith("pol_")) {
      const actionKey = interaction.customId.replace("pol_", "");
      const action = ACTIONS[actionKey];
      if (!action) return;

      const modal = new ModalBuilder()
        .setCustomId(`modal_${actionKey}`)
        .setTitle(action.title);

      const userInput = new TextInputBuilder()
        .setCustomId("user")
        .setLabel("Person / Beamter")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("Name eingeben");

      const moneyInput = new TextInputBuilder()
        .setCustomId("money")
        .setLabel("Geldbetrag")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("z.B. 50000");

      const rankInput = new TextInputBuilder()
        .setCustomId("rank")
        .setLabel("Rang")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("z.B. Officer II");

      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Grund")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder("Warum?");

      const extraInput = new TextInputBuilder()
        .setCustomId("extra")
        .setLabel("Weitere Angaben")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder("Dauer, Dienstnummer, Notizen usw.");

      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(moneyInput),
        new ActionRowBuilder().addComponents(rankInput),
        new ActionRowBuilder().addComponents(reasonInput),
        new ActionRowBuilder().addComponents(extraInput)
      );

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_")) {
      const actionKey = interaction.customId.replace("modal_", "");
      const action = ACTIONS[actionKey];
      if (!action) return;

      const user = interaction.fields.getTextInputValue("user");
      const money = interaction.fields.getTextInputValue("money") || "Nicht angegeben";
      const rank = interaction.fields.getTextInputValue("rank") || "Nicht angegeben";
      const reason = interaction.fields.getTextInputValue("reason");
      const extra = interaction.fields.getTextInputValue("extra") || "Keine";

      const embed = new EmbedBuilder()
        .setTitle(`POL ${action.label}`)
        .setColor(action.color)
        .addFields(
          { name: "Person", value: user, inline: true },
          { name: "Bearbeitet von", value: interaction.user.tag, inline: true },
          { name: "Geld", value: money, inline: true },
          { name: "Rang", value: rank, inline: true },
          { name: "Grund", value: reason, inline: false },
          { name: "Weitere Angaben", value: extra, inline: false }
        )
        .setTimestamp();

      let targetChannel = interaction.channel;

      if (LOG_CHANNEL_ID) {
        const fetchedChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (fetchedChannel && fetchedChannel.type === ChannelType.GuildText) {
          targetChannel = fetchedChannel;
        }
      }

      await targetChannel.send({ embeds: [embed] });

      return interaction.reply({
        content: `${action.label} wurde eingetragen.`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error(error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Es gab einen Fehler.",
        ephemeral: true
      });
    }
  }
});

(async () => {
  await registerCommands();
  await client.login(TOKEN);
})();

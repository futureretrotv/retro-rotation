// IGDB platform ID → local console PNG filename (in public/consoles/)
const PLATFORM_MAP = {
  18: 'nes',
  19: 'snes',
  29: 'genesis',
  4: 'n64',
  33: 'gameboy',
  22: 'gbc',
  24: 'gba',
  7: 'ps1',
  8: 'ps2',
  44: 'atari2600',
  11: 'xbox',
  12: 'xbox360',
  49: 'xbox-one',
  5: 'wii',
  41: 'wii-u',
  130: 'switch',
  167: 'switch',
  21: 'gamecube',
  23: 'dreamcast',
  32: 'saturn',
  6: 'pc',
};

// Ordered list of console options for the display override dropdown.
// consoleName must match a PNG filename in public/consoles/.
const PLATFORM_CONSOLE_IMAGE_MAP = [
  { label: 'NES', consoleName: 'nes' },
  { label: 'SNES', consoleName: 'snes' },
  { label: 'N64', consoleName: 'n64' },
  { label: 'GameCube', consoleName: 'gamecube' },
  { label: 'Wii', consoleName: 'wii' },
  { label: 'Wii U', consoleName: 'wii-u' },
  { label: 'Nintendo Switch', consoleName: 'switch' },
  { label: 'Game Boy', consoleName: 'gameboy' },
  { label: 'Game Boy Color', consoleName: 'gbc' },
  { label: 'Game Boy Advance', consoleName: 'gba' },
  { label: 'PlayStation', consoleName: 'ps1' },
  { label: 'PlayStation 2', consoleName: 'ps2' },
  { label: 'Xbox', consoleName: 'xbox' },
  { label: 'Xbox 360', consoleName: 'xbox360' },
  { label: 'Xbox One', consoleName: 'xbox-one' },
  { label: 'Sega Genesis', consoleName: 'genesis' },
  { label: 'Sega Saturn', consoleName: 'saturn' },
  { label: 'Dreamcast', consoleName: 'dreamcast' },
  { label: 'Atari 2600', consoleName: 'atari2600' },
  { label: 'PC', consoleName: 'pc' },
];

module.exports = { PLATFORM_MAP, PLATFORM_CONSOLE_IMAGE_MAP };

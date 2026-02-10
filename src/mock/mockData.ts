import type { OwnedSong } from "../types/song";

export const mockInventory: OwnedSong[] = [
  {
    id: "s1",
    title: "Do Ya",
    artist: "ericdoa",
    coverUrl:
      "https://assets.crownnote.com/s3fs-public/2024-11/1000x1000bb%20%2816%29.png",
    genre: "Hyperpop",
    rarity: "Rare",
    obtainedAt: new Date().toISOString(),
  },
  {
    id: "s2",
    title: "L.A. Girls",
    artist: "Weezer",
    coverUrl:
      "https://www.weezerpedia.com/w/images/7/72/Weezer_The_White_Album.jpg",
    genre: "Rock",
    rarity: "Common",
    obtainedAt: new Date().toISOString(),
  },
  {
    id: "s3",
    title: "Feel Good Inc",
    artist: "Gorillaz",
    coverUrl:
      "https://upload.wikimedia.org/wikipedia/en/d/df/Gorillaz_Demon_Days.PNG",
    genre: "Alternative",
    rarity: "Epic",
    obtainedAt: new Date().toISOString(),
  },
  {
  id: "s10",
  title: "Gabriella",
  artist: "Katseye",
  coverUrl:
    "https://i.scdn.co/image/ab67616d0000b273f8d4d00ffe09373efb13ce29",
  genre: "Pop",
  rarity: "Legendary",
  obtainedAt: new Date().toISOString(),
},
  {
    id: "s4",
    title: "Buddy Holly",
    artist: "Weezer",
    coverUrl:
      "https://www.weezerpedia.com/w/images/4/43/Weezer_The_Blue_Album.jpg",
    genre: "Rock",
    rarity: "Legendary",
    obtainedAt: new Date().toISOString(),
  },
  
  {
    id: "s5",
    title: "Island In The Sun",
    artist: "Weezer",
    coverUrl:
      "https://www.weezerpedia.com/w/images/0/0d/Weezer_The_Green_Album.jpg",
    genre: "Rock",
    rarity: "Uncommon",
    obtainedAt: new Date().toISOString(),
  },
  {
    id: "s6",
    title: "Girl If You're Wondering If I Want You Too (I Want You Too)",
    artist: "Weezer",
    coverUrl:
      "https://www.weezerpedia.com/w/images/thumb/d/d0/Weezer_Raditude.jpg/440px-Weezer_Raditude.jpg",
    genre: "Rock",
    rarity: "Uncommon",
    obtainedAt: new Date().toISOString(),
  },
  {
    id: "s7",
    title: "I'll See You In 40",
    artist: "Joji",
    coverUrl:
      "https://upload.wikimedia.org/wikipedia/en/6/6a/Joji_%E2%80%93_Ballads_1.png",
    genre: "Indie",
    rarity: "Epic",
    obtainedAt: new Date().toISOString(),
  },
  {
    id: "s8",
    title: "QB Blitz",
    artist: "Weezer",
    coverUrl:
      "https://www.weezerpedia.com/w/images/5/57/Weezer_Pacific_Daydream.png?20170820180935",
    genre: "Pop-Rock",
    rarity: "Epic",
    obtainedAt: new Date().toISOString(),
  },
  {
    id: "s9",
    title: "The Good Life",
    artist: "Weezer",
    coverUrl: "https://www.weezerpedia.com/w/images/f/ff/Weezer_Pinkerton.jpg",
    genre: "Rock",
    rarity: "Rare",
    obtainedAt: new Date().toISOString(),
  },
];

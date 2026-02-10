// src/mock/sleeves.ts
import type { Sleeve } from "../types/sleeve";

export const MOCK_SLEEVES: Sleeve[] = [
  {
    id: "sleeve_pop_01",
    name: "Pop Sleeve",
    genre: "Pop",
    cost: 20,
    refreshedWeekly: true,
    contents: [
      {
  id: "song_pop_gabriella",
  title: "Gabriella",
  artist: "Katseye",
  coverUrl:
    "https://i.scdn.co/image/ab67616d0000b273f8d4d00ffe09373efb13ce29",
  genre: "Pop",
  rarity: "Legendary",
},
{
  id: "song_pop_espresso",
  title: "Espresso",
  artist: "Sabrina Carpenter",
  coverUrl:
    "https://upload.wikimedia.org/wikipedia/en/f/fd/Short_n%27_Sweet_-_Sabrina_Carpenter.png",
  genre: "Pop",
  rarity: "Epic",
},
{
  id: "song_pop_apt",
  title: "APT.",
  artist: "ROSÉ, Bruno Mars",
  coverUrl:
    "https://upload.wikimedia.org/wikipedia/en/5/52/Ros%C3%A9_and_Bruno_Mars_-_Apt..png",
  genre: "Pop",
  rarity: "Rare",
},
{
  id: "song_pop_animals",
  title: "Animals",
  artist: "Maroon 5",
  coverUrl:
    "https://i.ytimg.com/vi/LTem11kie-k/maxresdefault.jpg",
  genre: "Pop",
  rarity: "Rare",
},
{
  id: "song_pop_dont_mine_at_night",
  title: "Don't Mine At Night",
  artist: "Bebop Vox",
  coverUrl:
    "https://i.scdn.co/image/ab67616d0000b273424da79bb4d058749f13d7e6",
  genre: "Pop",
  rarity: "Rare",
},
{
  id: "song_pop_baby",
  title: "Baby",
  artist: "Justin Bieber",
  coverUrl: "https://upload.wikimedia.org/wikipedia/en/d/d1/Babycoverart.jpg",
  genre: "Pop",
  rarity: "Uncommon",
},
{
  id: "song_pop_sunflower",
  title: "Sunflower",
  artist: "Post Malone, Swae Lee",
  coverUrl:
    "https://i.scdn.co/image/ab67616d00001e02e2e352d89826aef6dbd5ff8f",
  genre: "Pop",
  rarity: "Uncommon",
},
{
  id: "song_pop_happy",
  title: "Happy",
  artist: "Pharell Williams",
  coverUrl:
    "https://upload.wikimedia.org/wikipedia/en/2/23/Pharrell_Williams_-_Happy.jpg",
  genre: "Pop",
  rarity: "Common",
},

    ],
  },

  {
    id: "sleeve_rock_01",
    name: "Rock Sleeve",
    genre: "Rock",
    cost: 20,
    refreshedWeekly: true,
    contents: [
      {
        id: "song_rock_buddy_holly",
        title: "Buddy Holly",
        artist: "Weezer",
        coverUrl:
          "https://www.weezerpedia.com/w/images/4/43/Weezer_The_Blue_Album.jpg",
        genre: "Rock",
        rarity: "Legendary",
      },
      {
        id: "song_rock_faint",
        title: "Faint",
        artist: "Linkin Park",
        coverUrl:
          "https://i1.sndcdn.com/artworks-000153667132-7qckxk-t500x500.jpg",
        genre: "Rock",
        rarity: "Epic",
      },
      {
        id: "song_rock_bring_me_to_life",
        title: "Bring Me To Life",
        artist: "Evanescence",
        coverUrl:
          "https://upload.wikimedia.org/wikipedia/en/2/25/Evanescence_-_Fallen.png",
        genre: "Rock",
        rarity: "Epic",
      },
      {
        id: "song_rock_good_life",
        title: "The Good Life",
        artist: "Weezer",
        coverUrl: "https://www.weezerpedia.com/w/images/f/ff/Weezer_Pinkerton.jpg",
        genre: "Rock",
        rarity: "Rare",
      },
      {
        id: "song_rock_island_sun",
        title: "Island In The Sun",
        artist: "Weezer",
        coverUrl:
          "https://www.weezerpedia.com/w/images/0/0d/Weezer_The_Green_Album.jpg",
        genre: "Rock",
        rarity: "Uncommon",
      },
      {
        id: "song_rock_fell_in_love_with_a_girl",
        title: "Fell In Love With A Girl",
        artist: "White Stripes",
        coverUrl:
          "https://i.scdn.co/image/ab67616d0000b273ce400791df807dc75c702bed",
        genre: "Rock",
        rarity: "Uncommon",
      },
      {
        id: "song_rock_everlong",
        title: "Everlong",
        artist: "Foo Fighters",
        coverUrl:
          "https://i.scdn.co/image/ab67616d0000b2734bc9bcdbdc9ac34e37d8b6bb",
        genre: "Rock",
        rarity: "Common",
      },
      {
        id: "song_rock_chop_suey",
        title: "Chop Suey",
        artist: "System Of A Down",
        coverUrl:
          "https://upload.wikimedia.org/wikipedia/en/6/64/SystemofaDownToxicityalbumcover.jpg",
        genre: "Rock",
        rarity: "Common",
      },
    ],
  },

  {
    id: "sleeve_indie_01",
    name: "Indie Sleeve",
    genre: "Indie",
    cost: 22,
    refreshedWeekly: true,
    contents: [
      {
        id: "song_indie_see_you_40",
        title: "I'll See You In 40",
        artist: "Joji",
        coverUrl:
          "https://upload.wikimedia.org/wikipedia/en/6/6a/Joji_%E2%80%93_Ballads_1.png",
        genre: "Indie",
        rarity: "Epic",
      },
    ],
  },
];

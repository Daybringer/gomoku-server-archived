interface time {
  timeLeft: number;
  timeStamp: number;
}

interface Game {
  nicks: { [key: string]: string };
  first: number;
  round: number;
  isTimed: boolean;
  times: time[];
  won: boolean | null;
  gamePlan: number[][];
  players: string[];
  intervalLink: NodeJS.Timeout | null;
  elo?: {
    [key: string]: number;
  };
}

interface gameMode {
  quick: {
    que: string[];
    games: { [key: string]: Game };
  };
  private: { games: { [key: string]: Game } };
  ranked: {
    que: [
      { id: string; elo: number; username: string },
      { id: string; elo: number; username: string }
    ];
    games: { [key: string]: Game };
  };
}

export { Game, time, gameMode };

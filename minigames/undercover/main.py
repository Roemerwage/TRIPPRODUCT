from game import *
from player import *

if __name__ == "__main__":
    player_turn_name : str
    current_active_game : bool
    eliminated_player : Player
    new_game : bool
    keep_playing : bool
    players : list[Player]
    game_parameters : list[int]

    print("Welcome to Undercover!\n")
    new_game = True
    while new_game:
        new_game = False
        keep_playing = True
        players, game_parameters = first_game()
        print("Setup complete. The game starts!\n")
        while keep_playing:
            reveal_secret_word(players)
            current_active_game = True
            
            # Détermine aléatoirement le joueur qui commence
            i : int = random.randint(1, len(players))
            while current_active_game:
                for player in players:
                    if player.number == i:
                        player_turn_name = player.name
                print(f"Discussion phase. {player_turn_name} starts.\n")
                eliminated_player, players = phase_elimination(players)
                if eliminated_player.role == "Mr. White":
                    print("They can still win if they guess the Civilians' secret word.")
                    eliminated_player.secret_word = input("What is the Civilians' secret word?\n")
                # Si le joueur éliminé est le joueur qui devait commencer, on passe au joueur suivant
                if eliminated_player.number == i:
                    i += 1
                    if i > len(players):
                        i = 1
                current_active_game = determine_winner(players)
            entree: str = ''
            while True:
                print("1 - Play again with the same settings")
                print("2 - Play again with new settings")
                print("3 - View scores")
                print("4 - Quit")
                entree = input("Choice: ")
                match entree:
                    case '1':
                        print("New game!\n")
                        players = role_allocation(players, game_parameters)
                    case '2':
                        new_game = True
                        keep_playing = False
                    case '3':
                        score(players)
                    case '4':
                        keep_playing = False
                    case _:
                        print("Error: invalid menu option.")
                if entree in ['1', '2', '4']:
                    break

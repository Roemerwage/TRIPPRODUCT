import os
import random
from player import Player


def first_game():
    players = []
    while True:
        num_players = input_number("How many players? ")
        if num_players < 3:
            print("At least 3 players are required.")
        else:
            break
    print(f"{num_players}? I need names.")
    i : int = 0
    while i!=num_players:
        while True:
            name = input_string(f"Player {i+1} name: ")
            if name in [player.name for player in players]:
                print("That name is already taken.")
            else:
                break
        players.append(Player(name, i+1))       
        i+=1
        
    entree: str = ''
    while True:
        print("Number of Undercovers and Mr. Whites...")
        print("1 - random")
        print("2 - custom")
        entree = input_string("Choice: ")
        match entree:
            case '1':
                num_civils = random.randint(2, num_players - 1)
                num_undercovers = random.randint(1, num_players - num_civils)
                num_mr_whites = num_players - num_civils - num_undercovers
            case '2':
                while True:
                    num_undercovers = input_number("How many Undercovers? ")
                    if num_undercovers > num_players - 2 or num_undercovers < 1:
                        print(f"Invalid number of Undercovers. It must be between 1 and {num_players - 2}.")
                    else:
                        break
                while True:
                    num_mr_whites = input_number("How many Mr. Whites? ")
                    if num_mr_whites > num_players - num_undercovers - 1 or num_mr_whites < 0:
                        print(f"Invalid number of Mr. Whites. It must be between 0 and {num_players - num_undercovers - 2}.")
                    else:
                        break
                num_civils = num_players - num_undercovers - num_mr_whites
            case _:
                print("Error: invalid menu option.")
        if entree in ['1', '2']:
            break
    game_parameters = [num_players, num_civils, num_undercovers, num_mr_whites]
    players = role_allocation(players, game_parameters)
    return players, game_parameters


def role_allocation(players, game_parameters):
    random.shuffle(players)
    # Load the secret word pairs.
    with open("secret_words.txt", "r") as f:
        lines = f.readlines()
    secret_words = [line.strip().split(";") for line in lines]
    if len(secret_words) == 0:
        print("No secret words available. Add more to 'secret_words.txt'.")
        os._exit(0)
    
    players = reset_roles_and_status(players)
  
    secret_word_pair = secret_words[random.randint(0, len(secret_words) - 1)]
    undercover_word = random.randint(0,1)
    for i in range(game_parameters[2]):
        # Pick a random Undercover and assign the secret word.
        number = random.randint(0, len(players) - 1)
        players[number].role = "Undercover"
        players[number].secret_word = secret_word_pair[undercover_word]
        
    if undercover_word == 0:
        civil_word = 1
    else:
        civil_word = 0
    
    for i in range(game_parameters[3]):
        # Pick a random Mr. White and give no secret word.
        number = random.randint(0, len(players) - 1)
        while players[number].role == "Undercover" or players[number].role == "Mr. White":
            number = random.randint(0, len(players) - 1)
        players[number].role = "Mr. White"
        players[number].secret_word = None
    
    # Assign the civil secret word to anyone without a role.
    for player in players:
        if player.role == None:
            player.role = "Civil"
            player.secret_word = secret_word_pair[civil_word]
       
        
    # Append the used pair to "used_secret_words.txt".
    with open("used_secret_words.txt", "a") as f:
        f.write(secret_word_pair[0] + ";" + secret_word_pair[1] + "\n")
    # Remove the used pair from "secret_words.txt".
    with open("secret_words.txt", "w") as f:
        for line in lines:
            if line.strip('\n') != secret_word_pair[0] + ";" + secret_word_pair[1]:
                f.write(line)

    random.shuffle(players)
    return players


def reset_roles_and_status(players):
    for player in players:
        player.role = None
        player.secret_word = None
        player.is_eliminated = False
    return players


def phase_elimination(players):
    while True:
        eliminated_player_name = input_string("Who do you want to vote for? ")
        if eliminated_player_name in [player.name for player in players]:
            break
        else:
            print("Error: that player does not exist.")
    eliminated_player = next(player for player in players if player.name == eliminated_player_name)
    eliminated_player.eliminate()
    print(f"{eliminated_player.name} was a {eliminated_player.role}.")
    return eliminated_player, players
    

def determine_winner(players):
    num_civils = 0
    num_undercovers = 0
    num_mr_whites = 0
    for player in players:
        if player.role == "Civil":
            civil_secret_word = player.secret_word
    for player in players:
        if player.role == "Civil" and not player.is_eliminated:
            num_civils += 1
        elif player.role == "Undercover" and not player.is_eliminated:
            num_undercovers += 1
        elif player.role == "Mr. White":
            if not player.is_eliminated:
                num_mr_whites += 1
            # Si Mr. White a deviné le mot secret des Civils, alors Mr. White a gagné
            elif player.secret_word == civil_secret_word and player.is_eliminated:
                print("Mr. White wins!")
                # Give 6 points to Mr. White.
                for player in players:
                    if player.role == "Mr. White":
                        player.score += 6
                return False
            else:
                print("Missed. Mr. White was eliminated.")
    
    # print("Test : il reste", num_civils, "Civils,", num_undercovers, "Undercovers et", num_mr_whites, "Mr. White.")
    
    if num_civils == 1 and num_mr_whites == 0 and num_undercovers > 0:
        print("Undercovers win!")
        # Give 10 points to Undercovers.
        for player in players:
            if player.role == "Undercover":
                player.score += 10
        return False
    elif num_undercovers == 0 and num_civils == 1 and num_mr_whites > 0:
        print("Mr. White wins!")
        # Give 6 points to Mr. White.
        for player in players:
            if player.role == "Mr. White":
                player.score += 6
        return False
    # Si tous les Imposteurs ont été éliminés, alors les Civils ont gagné
    elif num_undercovers == 0 and num_mr_whites == 0:
        print("Civilians win!")
        # Give 2 points to Civilians.
        for player in players:
            if player.role == "Civil":
                player.score += 2
        return False
    else:
        print("The game continues.")
        return True
    
def reveal_secret_word(players):
    os.system('cls')
    # Reveal each player's word in numeric order.
    number = 1
    print("Here is each player's secret word:")
    while number <= len(players):
        for player in players:
            if player.number == number:
                print(f"\033[36m{player.name}\033[0m, your secret word is...")
                input("")
                if player.role == "Mr. White":
                    print("\033[31m" + "You are Mr. White!" + "\033[0m")
                else:
                    print('\033[31m' + player.secret_word.upper() + '\033[0m')
                input("Press any key to hide the secret word...")
                os.system('cls')
                print("Secret word hidden.\n")
                number += 1
                

def score(players):
    os.system('cls')
    # Show scores in numeric order.
    number = 1
    print("Here is each player's score:")
    while number <= len(players):
        for player in players:
            if player.number == number:
                print(f"{player.name} : {player.score} point(s)")
                number += 1
    input("Press any key to continue...")
    os.system('cls')

def input_number(message):
    while True:
        # If input is not a number, retry.
        try:
            entree = int(input(message))
        except ValueError:
            print("Error: please enter a number.")
            continue
        if entree != "":
            break
    return entree

def input_string(message):
    while True:
        entree = input(message)
        if entree != "":
            break
    return entree

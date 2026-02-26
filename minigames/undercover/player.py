class Player:
    def __init__(self, name, number):
        self.role = None
        self.name = name
        self.number = number
        self.secret_word = None
        self.score = 0
        self.is_eliminated = False

    def eliminate(self):
        self.is_eliminated = True

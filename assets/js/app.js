// Initialize Firebase
const config = {
    apiKey: "AIzaSyAFCI1LBk7YQ6kWN5mXrv4FOCm4b_sBaxk",
    authDomain: "multiplayer-rps-7ad91.firebaseapp.com",
    databaseURL: "https://multiplayer-rps-7ad91.firebaseio.com",
    projectId: "multiplayer-rps-7ad91",
    storageBucket: "multiplayer-rps-7ad91.appspot.com",
    messagingSenderId: "892854720255"
};
firebase.initializeApp(config);
// Store global database variable
const database = firebase.database();

// Game logic and functions
const GAME = {
    userName: null,
    opponentName: null,
    userWins: 0,
    startGame: function () {
        // Update opponent card
        UI.updateOpponentTitle(GAME.opponentName);
        UI.enableSelectionButtons();
    },
    resetMoves: function () {
        UI.resetMoves();
    },
    calculateWinner: function (playerMove, opponentMove) {
        let choices = ["rock", "paper", "scissors"];
        let playerMoveIdx = choices.indexOf(playerMove);
        let opponentMoveIdx = choices.indexOf(opponentMove);

        // Tie
        if (playerMoveIdx === opponentMoveIdx) {
            return -1;
        }
        // Win
        else if ((playerMoveIdx - opponentMoveIdx + 3) % 3 === 1) {
            return 1;
        }
        // Lose
        else {
            return 0;
        }
    }
};

// Object for handling database interactions
const DATA_OBJ = {
    playersRef: database.ref("/players"),
    init: function () {
        // Register event handlers
        this.registerPresence();
        this.registerPlayerChanges();
        this.registerMovesUpdates();
        this.registerScoreUpdates();
        this.registerGameUpdates();
        this.registerChatUpdates();
    },
    registerPresence: function () {
        database.ref("/.info/connected").on("value", function (snapshot) {
            if (!snapshot.val()) {
                database.ref("/game").remove();
                database.ref("/chat").remove();
            }
        });
    },
    registerPlayerChanges: function () {
        this.playersRef.on("value", function (snapshot) {
            let players = snapshot.val();
            // Wait for two players to join the game
            if (snapshot.numChildren() === 2) {
                // Store opponent name in game object
                let opponentKey = Object.keys(players).find(function (key) {
                    return players[key].userName !== GAME.userName
                });
                GAME.opponentName = players[opponentKey].userName;

                // Create game and chat in DB
                DATA_OBJ.createGame();
                DATA_OBJ.createChat();

                // Start game logic
                GAME.startGame();

            } else if (snapshot.numChildren() === 1) {
                // Wait for opponent to join the game
                UI.disableSelectionButtons();
                UI.updateOpponentTitle("Waiting...");
            }
        });
    },
    registerMovesUpdates: function () {
        database.ref("/game/moves").on("value", function (snapshot) {
            let moves = snapshot.val();
            // Wait for both users to submit their move
            if (snapshot.numChildren() === 2) {

                let playerMove = moves[GAME.userName].move;
                let opponentMove = moves[GAME.opponentName].move;

                // Display image and text
                UI.updateOpponentMove(opponentMove);

                let outcome = GAME.calculateWinner(playerMove, opponentMove);
                // Win = 1
                if (outcome > 0) {
                    GAME.userWins++;
                    // Update score in database
                    database.ref("/game/" + GAME.userName + "/score").set(GAME.userWins);
                }
                // Reset moves for next round
                database.ref("/game/moves/" + GAME.userName).remove();
                // Pause and reset for the next move
                setTimeout(function () {
                    GAME.resetMoves();
                }, 2000);
            }
        });
    },
    registerScoreUpdates: function () {
        database.ref("/game/").on("child_changed", function (snapshot) {
            // After round, check for the updated score
            if (snapshot.val().score) {
                let winner = snapshot.key;
                let score = snapshot.val().score;
                // Only the winner's score will update
                UI.updateScore(winner, score);
            }

        })
    },
    registerGameUpdates: function () {
        database.ref("/game").on("value", function (snapshot) {
            if (!snapshot.val()) {
                // reset game if users disconnect
                GAME.resetMoves();
            }
        });
    },
    registerChatUpdates: function () {
        database.ref("/chat").on("child_added", function (snapshot) {
            let message = snapshot.val();
            UI.appendMessage(message.user, message.message)
        });
    },
    createUser: function() {
        let playerRefKey = this.playersRef.push();
        // Set user details
        playerRefKey.set({userName: GAME.userName, connected: true});

        // Remove player when connection ends
        playerRefKey.onDisconnect().remove();
    },
    createGame: function() {
        // Create and save new game
        let game = {
            moves: null,
            score: 0
        };
        // create game in DB
        let gameRefKey = database.ref("/game/" + GAME.userName);
        gameRefKey.set(game);
        gameRefKey.onDisconnect().remove();
    },
    createChat: function() {
        // Initialize default chat
        let chat = {
            user:"System",
            message:"Game started. Have fun!"
        };
        // create chat in DB
        let chatRefKey = database.ref("/chat/init");
        chatRefKey.set(chat);
        database.ref("/chat").onDisconnect().remove();
    },
    addMessageToDB: function (user, message) {
        database.ref("/chat").push({user: user, message: message});

    },
    saveMove: function(move) {
        database.ref("/game/moves/" + GAME.userName).set({move: move});
    }
};

const UI = {
    init: function () {
        this.registerSelectionButtons();
        this.registerChatSendButton();
    },
    resetMoves: function () {
        // Clear images and opponent text
        $(".move-display").empty();
        $("#opponent-text").empty();
        // Enable buttons
        this.enableSelectionButtons();
    },
    registerSelectionButtons: function () {
        $("#move-selections").find("button").on("click", function () {
            // Get value of the move: rock, paper, or scissors
            let selection = $(this).attr("data-move");
            // Choose image based on selection
            let img = $('<img />', {
                src: `assets/images/${selection}.png`,
                alt: selection
            });
            $("#player-selection").html(img);
            // Disable buttons until the round is over
            UI.disableSelectionButtons();
            // Save move to database
            DATA_OBJ.saveMove(selection);
        });
    },
    registerChatSendButton: function () {
        $("#send-button").on("click", function () {
            let $messageInput = $("#message");
            let messageText = $messageInput.val();
            // Clear input on send
            $messageInput.val("");
            DATA_OBJ.addMessageToDB(GAME.userName, messageText);
        });

        // Allow enter key to call submit the message
        $('#message').keypress(function (e) {
            if (e.which === 13) {
                $('#send-button').click();
            }
        });
    },
    appendMessage: function (user, message) {
        let $p = $("<p>");
        let $nameSpan = $("<span>");
        $p.append($nameSpan);
        // Username span with bootstrap badge
        $nameSpan.text(`${user}: `);
        $nameSpan.addClass("badge");

        // Add message
        $p.append(`  ${message}`);
        $p.addClass("chat-message");

        // Messages from other users appear to the right in the chat
        if (user !== GAME.userName) {
            $p.css("text-align", "right");
            $nameSpan.addClass("badge-secondary");
        } else {
            $nameSpan.addClass("badge-primary");
        }
        let $chatWindow = $("#chat-window");
   
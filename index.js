var argv = require('minimist')(process.argv.slice(2));
const axios = require('axios').default;
const io = require("socket.io-client");
var user;
var roomID;
var gameRound;
var nextTurn;
var books;
var bets =[]

const headers = {
    'Content-Type': 'application/json'
  }

var CONFIG = {
    "user" : argv.u.toString(),
    "pass" : argv.p.toString(),
    "showLog" : (argv.l) ? true : false
}


axios.post('http://181.114.143.80:8000/users/signin', {
    email: CONFIG.user,
    password: CONFIG.pass
  })
  .then(function (response) {
    user = response.data
    if(CONFIG.showLog) console.log("User logged in! ID: " + user.userID);
    connection();
  })
  .catch(function (error) {
    console.log("User cant connect");
  });

  var connection = function(){
    if(CONFIG.showLog) console.log("Trying socket connection...");
    socket = io("http://192.168.1.10:8000", { transports: ["websocket"] });
    socket.on("connect", () => {
      if(CONFIG.showLog) console.log("Socked is connected")
      if(CONFIG.showLog) console.log("Sending auth...")
      socket.emit('authenticate', {"token": user.token})
    });
    socket.on('authenticated', (value) => {
      if(value){
        if(CONFIG.showLog) console.log("Socked is authenticated now")
        if(CONFIG.showLog) console.log("Searching rooms...")
        socket.emit('searchGame', user.level)
      }else{
        console.log("Socket auth fail!")
      }
    }) 
    socket.on('Welcome', (rooms)=>{
      
      if(JSON.parse(rooms).length > 0){
        if(CONFIG.showLog) console.log("Rooms: " + rooms)
        roomID = JSON.parse(rooms)[0].id
        if(CONFIG.showLog) console.log("Entering to room: " + roomID);
        socket.emit('join', {"roomId": roomID, "user": user})
        if(CONFIG.showLog) console.log("Waiting to comple the room...");

      }else{
        console.log("Rooms not found");
      }
    })

    socket.on('newRound', (round)=>{
      gameRound = JSON.parse(round)
      nextTurn = gameRound.nextTurn;
      books = gameRound.users[socket.id].books;
      bets = []

      if(gameRound.round_number == 1){
        if(CONFIG.showLog) console.log("Starting game");
        if(CONFIG.showLog) console.log("\x1b[31m","Round N°: " + gameRound.round_number);
        if(CONFIG.showLog) console.log("My books: " + books);
        checkMyTurn(socket.id, gameRound);
      }else{
        if(CONFIG.showLog) console.log("\x1b[31m","Round N°: " + gameRound.round_number);
        if(CONFIG.showLog) console.log("My books: " + books);
        checkMyTurn(socket.id, gameRound);
      }
      
    })

    socket.on('newBet', (data)=>{
      let myData = JSON.parse(data)
      if(CONFIG.showLog) console.log("New bet received");
      if(CONFIG.showLog) console.log(myData.bet);
      nextTurn++;
      bets.push(myData.bet)
      checkMyTurn(socket.id, gameRound);
    })

    socket.on('userLeftRound', (userIDLeftRound)=>{
      if(CONFIG.showLog) console.log("User: " + userIDLeftRound + " skip the current round.");
    })

    socket.on('userLeft', (userIDLeftGame)=>{
      if(CONFIG.showLog) console.log("User: " + userIDLeftGame + " has left the game.");
    })

    socket.on('question', (question)=>{
      if(CONFIG.showLog) console.log("New question received");
      let timeout = Math.floor(Math.random() * 7000) + 2000
      setTimeout(() => {
        let option = Math.floor(Math.random() * 3) + 1
        if(CONFIG.showLog) console.log("Sending answer...");
        socket.emit('userAnswer', {"answer": "option_" + option, "roomID": roomID, "timeResponse": timeout, userID: user.userID})
      }, timeout);
    })

    socket.on('pairingBet', (dataRec)=>{
      userRec = JSON.parse(dataRec)
      console.log("pairing");
      console.log("Estado de las apuestas");
      console.log(bets);
      if(userRec.userID == user.userID){
        defineBet();
      }else{
        console.log("No soy yo.");
      }
    })

    socket.on('userWon', (userIDRec) => {
      if (userIDRec == user.userID) {
        if(CONFIG.showLog) console.log("Gane esta ronda.");
      }else{
        if(CONFIG.showLog) console.log("Perdí en esta ronda.");
      }
    })

    socket.on('duelNotice', ()=>{
      if(CONFIG.showLog) console.log("Enhorabuena! Has llegado al duelo");
      setTimeout(() => {
        socket.emit('duelAccept', {"roomID": roomID, "userID": user.userID})
      }, 5000);
    })

    socket.on('duelQuestion', (duelQuestion)=>{

      if(CONFIG.showLog) console.log("New duelQuestion received");
      let timeout = Math.floor(Math.random() * 7000) + 2000
      setTimeout(() => {
        let option = Math.floor(Math.random() * 3) + 1
        if(CONFIG.showLog) console.log("Sending answer...");
        socket.emit('duelAnswer', {"answer": "option_" + option, "roomID": roomID, "timeResponse": timeout, userID: user.userID})
      }, timeout);
    })

    socket.on('duelResult', (result)=>{
      console.log("result--------");
      console.log(result);
      let dataResult = JSON.parse(result);

      if (dataResult.userWonID == user.userID) {
        if(CONFIG.showLog) console.log("Wiiii, he ganado!!!");
        process.exit();
      }else{
        if(CONFIG.showLog) console.log("Será la próxima. Debo seguir aprendiendo!");
        process.exit();
      }
    })

    socket.on('userGameWon', (userIDRec) => {
      if (userIDRec == user.userID) {
        if(CONFIG.showLog) console.log("Gane, yeah! Im the best!!!!!");
          socket.disconnect();
          setTimeout(() => {
            if(CONFIG.showLog) console.log("Terminating...");
            process.exit();
          }, 5);
      }
    })
    

    socket.on('gameOver', (users)=>{
      let gameOverUsers = users;
      for (let index = 0; index < gameOverUsers.length; index++) {
        let element = gameOverUsers[index];
        if (element.userID == user.userID){
          if(CONFIG.showLog) console.log("Game over for meeeee :(");
          socket.disconnect();
          setTimeout(() => {
            if(CONFIG.showLog) console.log("Terminating...");
            process.exit();
          }, 5);
        }
        
      }
    })
  }

 function checkMyTurn(socketID, myRound){
  if( nextTurn == myRound.users[socketID].turn){

    if(nextTurn == 1){
      //Apostar
      if(CONFIG.showLog) console.log("My turn");
      if(CONFIG.showLog) console.log("Ready for bet");
      let timeresp = Math.floor(Math.random() * 7000) + 1000;
      setTimeout(() => {
        
        if (parseInt(books) <= 300) {
          if(CONFIG.showLog) console.log("Betting " + books);
          socket.emit('userBet', {"value": books , "roomID": roomID, "userID": user.userID, "left": false, "pairing": false})
          bets.push(books)
        }else{
          if(CONFIG.showLog) console.log("Betting " + "300");
          socket.emit('userBet', {"value": 300 , "roomID": roomID, "userID": user.userID, "left": false, "pairing": false})
          bets.push(300)
        }
        
      }, timeresp);
    }else{
      let max = Math.max(...bets);
      let timeresp = Math.floor(Math.random() * 7000) + 1000;
      setTimeout(() => {
        if(CONFIG.showLog) console.log("Betting " + max);
        socket.emit('userBet', {"value": max , "roomID": roomID, "userID": user.userID, "left": false, "pairing": false})
        bets.push(max)
      }, timeresp);
    }
      
  }else{
    if(CONFIG.showLog) console.log("Waiting for bet...");
  }
 } 


 function defineBet(){
    //Check max bet
    console.log("Calculo");
    let max = Math.max(...bets);
    if(CONFIG.showLog) console.log("Pairing...");
    let timeresp = Math.floor(Math.random() * 7000) + 1000;
    setTimeout(() => {
      if(CONFIG.showLog) console.log("Sending new bet: " + max);
      socket.emit("userBet", { "value": max, "userID": user.userID, "left": false, "roomID": roomID, "pairing": true })
      bets.push(max)
    }, timeresp);
    
 }

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';

const BOARD_SIZE = 5;
const MOVES_PER_GAME = 15;
const DAILY_REWARD_CAP = 50;
const KOPI_COST = 1500;
const GAME_COMPLETION_REWARD = 50;
const REWARD_STORAGE_KEY = 'haloappRewardPoints';
const DAILY_REWARD_STORAGE_KEY = 'haloappDailyRewardProgress';
const CANDIES = [
  { symbol: '●', color: '#EF4444', background: '#FEE2E2' },
  { symbol: '◆', color: '#2563EB', background: '#DBEAFE' },
  { symbol: '★', color: '#F59E0B', background: '#FEF3C7' },
  { symbol: '■', color: '#16A34A', background: '#DCFCE7' },
  { symbol: '▲', color: '#9333EA', background: '#F3E8FF' },
];

const createTile = () => Math.floor(Math.random() * CANDIES.length);

const createBoard = () => (
  Array.from({ length: BOARD_SIZE }, () => (
    Array.from({ length: BOARD_SIZE }, createTile)
  ))
);

const copyBoard = (board) => board.map((row) => [...row]);

const isAdjacent = (first, second) => (
  Math.abs(first.row - second.row) + Math.abs(first.col - second.col) === 1
);

const findMatches = (board) => {
  const matched = new Set();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let runStart = 0;

    for (let col = 1; col <= BOARD_SIZE; col += 1) {
      if (col < BOARD_SIZE && board[row][col] === board[row][runStart]) {
        continue;
      }

      if (col - runStart >= 3) {
        for (let matchCol = runStart; matchCol < col; matchCol += 1) {
          matched.add(`${row}-${matchCol}`);
        }
      }

      runStart = col;
    }
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let runStart = 0;

    for (let row = 1; row <= BOARD_SIZE; row += 1) {
      if (row < BOARD_SIZE && board[row][col] === board[runStart][col]) {
        continue;
      }

      if (row - runStart >= 3) {
        for (let matchRow = runStart; matchRow < row; matchRow += 1) {
          matched.add(`${matchRow}-${col}`);
        }
      }

      runStart = row;
    }
  }

  return matched;
};

const replaceMatches = (board, matched) => {
  const nextBoard = copyBoard(board);

  matched.forEach((key) => {
    const [row, col] = key.split('-').map(Number);
    nextBoard[row][col] = createTile();
  });

  return nextBoard;
};

const resolveCascadeMatches = (startingBoard) => {
  let nextBoard = copyBoard(startingBoard);
  let totalPoints = 0;
  let cascadeCount = 0;

  for (let cascade = 0; cascade < 8; cascade += 1) {
    const matched = findMatches(nextBoard);

    if (matched.size === 0) {
      break;
    }

    totalPoints += matched.size * 20;
    cascadeCount += 1;
    nextBoard = replaceMatches(nextBoard, matched);
  }

  return { nextBoard, totalPoints, cascadeCount };
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const readStoredRewards = async () => {
  const [totalPointsValue, dailyProgressValue] = await Promise.all([
    AsyncStorage.getItem(REWARD_STORAGE_KEY),
    AsyncStorage.getItem(DAILY_REWARD_STORAGE_KEY),
  ]);

  const totalPoints = Number(totalPointsValue || 0);
  let dailyProgress = {};

  try {
    dailyProgress = JSON.parse(dailyProgressValue || '{}');
  } catch {
    dailyProgress = {};
  }

  const today = getTodayKey();

  return {
    totalPoints: Number.isFinite(totalPoints) ? totalPoints : 0,
    dailyDate: dailyProgress.date === today ? today : today,
    dailyEarned: dailyProgress.date === today ? Number(dailyProgress.earned || 0) : 0,
  };
};

const saveStoredRewards = async (totalPoints, dailyEarned) => {
  await Promise.all([
    AsyncStorage.setItem(REWARD_STORAGE_KEY, String(totalPoints)),
    AsyncStorage.setItem(
      DAILY_REWARD_STORAGE_KEY,
      JSON.stringify({ date: getTodayKey(), earned: dailyEarned })
    ),
  ]);
};

export default function CommunityScreen({ onHome, onLogout }) {
  const [board, setBoard] = useState(createBoard);
  const [score, setScore] = useState(0);
  const [totalRewardPoints, setTotalRewardPoints] = useState(0);
  const [dailyRewardPoints, setDailyRewardPoints] = useState(0);
  const [rewardsLoaded, setRewardsLoaded] = useState(false);
  const [rewardGrantedThisGame, setRewardGrantedThisGame] = useState(false);
  const [movesLeft, setMovesLeft] = useState(MOVES_PER_GAME);
  const [message, setMessage] = useState('Drag a candy up, down, left, or right.');
  const boardScale = useRef(new Animated.Value(1)).current;
  const dragOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [draggingTile, setDraggingTile] = useState(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const gameOver = movesLeft <= 0;
  const pointsToKopi = Math.max(0, KOPI_COST - totalRewardPoints);
  const canRedeemKopi = totalRewardPoints >= KOPI_COST;

  const progressText = useMemo(() => {
    if (gameOver) {
      return dailyRewardPoints >= DAILY_REWARD_CAP
        ? 'Daily reward cap reached. Come back tomorrow.'
        : 'Game complete. Reward points added if today has cap left.';
    }

    return `${movesLeft} moves left`;
  }, [dailyRewardPoints, gameOver, movesLeft]);

  useEffect(() => {
    let mounted = true;

    readStoredRewards().then((storedRewards) => {
      if (!mounted) {
        return;
      }

      setTotalRewardPoints(storedRewards.totalPoints);
      setDailyRewardPoints(storedRewards.dailyEarned);
      setRewardsLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!rewardsLoaded) {
      return;
    }

    saveStoredRewards(totalRewardPoints, dailyRewardPoints);
  }, [dailyRewardPoints, rewardsLoaded, totalRewardPoints]);

  useEffect(() => {
    if (!gameOver || rewardGrantedThisGame) {
      return;
    }

    const remainingDailyPoints = Math.max(0, DAILY_REWARD_CAP - dailyRewardPoints);
    const pointsToAdd = Math.min(GAME_COMPLETION_REWARD, remainingDailyPoints);

    setRewardGrantedThisGame(true);

    if (pointsToAdd <= 0) {
      setMessage('Daily reward cap reached. Come back tomorrow for more kopi points.');
      return;
    }

    setDailyRewardPoints((currentPoints) => currentPoints + pointsToAdd);
    setTotalRewardPoints((currentPoints) => currentPoints + pointsToAdd);
    setMessage(`Game complete. You earned ${pointsToAdd} kopi points today.`);
  }, [dailyRewardPoints, gameOver, rewardGrantedThisGame]);

  const resetGame = () => {
    setBoard(createBoard());
    setDraggingTile(null);
    dragOffset.setValue({ x: 0, y: 0 });
    setScrollEnabled(true);
    setScore(0);
    setRewardGrantedThisGame(false);
    setMovesLeft(MOVES_PER_GAME);
    setMessage('Drag a candy up, down, left, or right.');
  };

  const redeemKopi = () => {
    if (!canRedeemKopi) {
      return;
    }

    setTotalRewardPoints((currentPoints) => currentPoints - KOPI_COST);
    setMessage('Kopi redeemed. Enjoy your treat!');
  };

  const playMatchAnimation = () => {
    boardScale.setValue(0.96);
    Animated.spring(boardScale, {
      toValue: 1,
      friction: 4,
      tension: 90,
      useNativeDriver: true,
    }).start();
  };

  const swapTiles = (firstTile, secondTile) => {
    if (gameOver || !isAdjacent(firstTile, secondTile)) {
      return;
    }

    const swappedBoard = copyBoard(board);
    const firstValue = swappedBoard[firstTile.row][firstTile.col];
    swappedBoard[firstTile.row][firstTile.col] = swappedBoard[secondTile.row][secondTile.col];
    swappedBoard[secondTile.row][secondTile.col] = firstValue;

    const { nextBoard, totalPoints, cascadeCount } = resolveCascadeMatches(swappedBoard);

    setMovesLeft((moves) => moves - 1);

    if (totalPoints === 0) {
      setMessage('No match. Try another swap.');
      return;
    }

    playMatchAnimation();
    setScore((currentScore) => currentScore + totalPoints);
    setBoard(nextBoard);
    setMessage(cascadeCount > 1 ? `Combo x${cascadeCount}. ${totalPoints} points!` : `Nice match. ${totalPoints} points!`);
  };

  const handleTileDrag = (row, col, gesture) => {
    if (gameOver) {
      return;
    }

    const absX = Math.abs(gesture.dx);
    const absY = Math.abs(gesture.dy);

    if (Math.max(absX, absY) < 22) {
      return;
    }

    const targetTile = { row, col };

    if (absX > absY) {
      targetTile.col += gesture.dx > 0 ? 1 : -1;
    } else {
      targetTile.row += gesture.dy > 0 ? 1 : -1;
    }

    if (
      targetTile.row < 0 ||
      targetTile.row >= BOARD_SIZE ||
      targetTile.col < 0 ||
      targetTile.col >= BOARD_SIZE
    ) {
      setMessage('Drag toward a candy beside it.');
      return;
    }

    swapTiles({ row, col }, targetTile);
  };

  const createDragResponder = (row, col) => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => (
      Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 4
    ),
    onMoveShouldSetPanResponderCapture: (_, gesture) => (
      Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 4
    ),
    onPanResponderGrant: () => {
      setDraggingTile({ row, col });
      setScrollEnabled(false);
      dragOffset.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: (_, gesture) => {
      dragOffset.setValue({
        x: Math.max(-32, Math.min(32, gesture.dx)),
        y: Math.max(-32, Math.min(32, gesture.dy)),
      });
    },
    onPanResponderRelease: (_, gesture) => {
      Animated.spring(dragOffset, {
        toValue: { x: 0, y: 0 },
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start(() => {
        setDraggingTile(null);
        setScrollEnabled(true);
      });

      handleTileDrag(row, col, gesture);
    },
    onPanResponderTerminate: (_, gesture) => {
      Animated.spring(dragOffset, {
        toValue: { x: 0, y: 0 },
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start(() => {
        setDraggingTile(null);
        setScrollEnabled(true);
      });

      if (Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) >= 10) {
        handleTileDrag(row, col, gesture);
      }
    },
    onShouldBlockNativeResponder: () => false,
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Candy Match" subtitle="A simple matching game for today" />

      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scoreRow}>
          <View style={styles.scoreTile}>
            <Text style={styles.scoreNumber}>{score}</Text>
            <Text style={styles.scoreLabel}>Game Score</Text>
          </View>
          <View style={styles.scoreTile}>
            <Text style={styles.scoreNumber}>{totalRewardPoints}</Text>
            <Text style={styles.scoreLabel}>Kopi Points</Text>
          </View>
        </View>

        <View style={styles.rewardCard}>
          <View style={styles.rewardHeader}>
            <Text style={styles.rewardTitle}>Kopi Reward Progress</Text>
            <Text style={styles.rewardMeta}>{dailyRewardPoints} / {DAILY_REWARD_CAP} today</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, (totalRewardPoints / KOPI_COST) * 100)}%` }]} />
          </View>
          <Text style={styles.rewardText}>
            {canRedeemKopi ? 'You have enough points to redeem kopi.' : `${pointsToKopi} more points to redeem kopi.`}
          </Text>
        </View>

        <View style={styles.messageCard}>
          <Ionicons name={gameOver ? 'trophy' : 'sparkles'} size={24} color="#2563EB" />
          <View style={styles.messageCopy}>
            <Text style={styles.messageTitle}>{gameOver ? 'Game complete' : progressText}</Text>
            <Text style={styles.messageText}>{gameOver ? progressText : message}</Text>
          </View>
        </View>

        <Animated.View style={[styles.board, { transform: [{ scale: boardScale }] }]}>
          {board.map((rowItems, row) => (
            <View key={`row-${row}`} style={styles.boardRow}>
              {rowItems.map((candyIndex, col) => {
                const candy = CANDIES[candyIndex];
                const isDragging = draggingTile?.row === row && draggingTile?.col === col;
                const dragResponder = createDragResponder(row, col);

                return (
                  <Animated.View
                    key={`${row}-${col}`}
                    {...dragResponder.panHandlers}
                    style={[
                      styles.candyTile,
                      { backgroundColor: candy.background },
                      isDragging ? styles.candyDragging : null,
                      isDragging ? { transform: dragOffset.getTranslateTransform() } : null,
                    ]}
                  >
                    <Text style={[styles.candyText, { color: candy.color }]}>{candy.symbol}</Text>
                  </Animated.View>
                );
              })}
            </View>
          ))}
        </Animated.View>

        <TouchableOpacity style={styles.resetButton} onPress={resetGame} activeOpacity={0.86}>
          <Ionicons name="refresh" size={22} color="#FFFFFF" />
          <Text style={styles.resetButtonText}>{gameOver ? 'Play again' : 'Restart game'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.kopiButton, !canRedeemKopi ? styles.kopiButtonDisabled : null]}
          onPress={redeemKopi}
          activeOpacity={0.86}
          disabled={!canRedeemKopi}
        >
          <Ionicons name="cafe" size={26} color="#FFFFFF" />
          <View style={styles.kopiCopy}>
            <Text style={styles.kopiButtonText}>{canRedeemKopi ? 'Redeem free kopi' : 'Kopi costs 1,500 points'}</Text>
            <Text style={styles.kopiButtonSubtext}>Earn up to 50 kopi points per day</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <SeniorBottomNav onHome={onHome} onCommunity={() => {}} onLogout={onLogout} activeTab="Community" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  scoreRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  scoreTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scoreNumber: { color: '#111827', fontSize: 28, fontWeight: '900' },
  scoreLabel: { color: '#6B7280', fontSize: 14, fontWeight: '800', marginTop: 2 },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  rewardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rewardTitle: { color: '#111827', fontSize: 17, fontWeight: '900', flex: 1 },
  rewardMeta: { color: '#2563EB', fontSize: 13, fontWeight: '900' },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#16A34A' },
  rewardText: { color: '#4B5563', fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 8 },
  messageCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  messageCopy: { flex: 1, marginLeft: 10 },
  messageTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  messageText: { color: '#4B5563', fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 2 },
  board: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  boardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  candyTile: {
    width: 58,
    height: 58,
    cursor: 'grab',
    touchAction: 'none',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  candyDragging: {
    zIndex: 10,
    elevation: 6,
    borderColor: '#2563EB',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  candyText: { fontSize: 30, fontWeight: '900' },
  resetButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resetButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  kopiButton: {
    backgroundColor: '#16A34A',
    width: '100%',
    minHeight: 70,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  kopiButtonDisabled: { backgroundColor: '#9CA3AF' },
  kopiCopy: { flex: 1, marginLeft: 12 },
  kopiButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  kopiButtonSubtext: { color: '#DCFCE7', fontSize: 13, fontWeight: '700', marginTop: 3 },
});

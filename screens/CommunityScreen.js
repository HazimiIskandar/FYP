import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';

const DAILY_REWARD_CAP = 50;
const KOPI_COST = 1500;
const GAME_COMPLETION_REWARD = 50;
const REWARD_STORAGE_KEY = 'haloappRewardPoints';
const DAILY_REWARD_STORAGE_KEY = 'haloappDailyRewardProgress';
const memoryStorage = {};

const MEMORY_ITEMS = [
  { key: 'kopi', label: 'Kopi', icon: 'cafe', color: '#92400E', background: '#FEF3C7' },
  { key: 'radio', label: 'Radio', icon: 'radio', color: '#1D4ED8', background: '#DBEAFE' },
  { key: 'home', label: 'Home', icon: 'home', color: '#166534', background: '#DCFCE7' },
  { key: 'music', label: 'Music', icon: 'musical-notes', color: '#7C2D12', background: '#FFEDD5' },
  { key: 'photo', label: 'Photo', icon: 'images', color: '#6D28D9', background: '#EDE9FE' },
  { key: 'book', label: 'Book', icon: 'book', color: '#BE123C', background: '#FFE4E6' },
  { key: 'phone', label: 'Phone', icon: 'call', color: '#0F766E', background: '#CCFBF1' },
  { key: 'news', label: 'News', icon: 'newspaper', color: '#4338CA', background: '#E0E7FF' },
];

const shuffle = (items) => {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
};

const createDeck = () => {
  const selectedItems = shuffle(MEMORY_ITEMS).slice(0, 8);
  const pairedItems = selectedItems.flatMap((item) => [
    { ...item, id: `${item.key}-a` },
    { ...item, id: `${item.key}-b` },
  ]);

  return shuffle(pairedItems);
};

const getTodayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getStorageItem = (key) => {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage.getItem(key);
  }

  return memoryStorage[key] || null;
};

const setStorageItem = (key, value) => {
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.setItem(key, value);
    return;
  }

  memoryStorage[key] = value;
};

const readStoredRewards = () => {
  const totalPointsValue = getStorageItem(REWARD_STORAGE_KEY);
  const dailyProgressValue = getStorageItem(DAILY_REWARD_STORAGE_KEY);

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
    dailyDate: today,
    dailyEarned: dailyProgress.date === today ? Number(dailyProgress.earned || 0) : 0,
  };
};

const saveStoredRewards = (totalPoints, dailyEarned) => {
  setStorageItem(REWARD_STORAGE_KEY, String(totalPoints));
  setStorageItem(
    DAILY_REWARD_STORAGE_KEY,
    JSON.stringify({ date: getTodayKey(), earned: dailyEarned })
  );
};

export default function CommunityScreen({ senior = {}, apiBase, onHome, onProfile, onSettings }) {
  const [cards, setCards] = useState(createDeck);
  const [flippedIds, setFlippedIds] = useState([]);
  const [matchedKeys, setMatchedKeys] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('Tap two cards to find a matching pair.');
  const [isChecking, setIsChecking] = useState(false);
  const [totalRewardPoints, setTotalRewardPoints] = useState(0);
  const [dailyRewardPoints, setDailyRewardPoints] = useState(0);
  const [rewardsLoaded, setRewardsLoaded] = useState(false);
  const [rewardGrantedThisGame, setRewardGrantedThisGame] = useState(false);

  const gameComplete = matchedKeys.length === 8;
  const pointsToKopi = Math.max(0, KOPI_COST - totalRewardPoints);
  const canRedeemKopi = totalRewardPoints >= KOPI_COST;

  const progressText = useMemo(() => {
    if (gameComplete) {
      return dailyRewardPoints >= DAILY_REWARD_CAP
        ? 'Daily reward cap reached. Come back tomorrow.'
        : 'Game complete. Reward points added if today has cap left.';
    }

    return `${matchedKeys.length} of 8 pairs found`;
  }, [dailyRewardPoints, gameComplete, matchedKeys.length]);

  useEffect(() => {
    let mounted = true;

    const loadRewards = async () => {
      if (apiBase && senior?.senior_id) {
        try {
          const response = await fetch(`${apiBase}/rewards/senior/${senior.senior_id}`);
          if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
          }

          const rewardData = await response.json();

          if (mounted) {
            setTotalRewardPoints(Number(rewardData?.total_points || 0));
            setDailyRewardPoints(Number(rewardData?.daily_points || 0));
            setRewardsLoaded(true);
          }
          return;
        } catch (error) {
          console.log('Failed to load backend reward summary:', error);
        }
      }

      const storedRewards = readStoredRewards();

      if (mounted) {
        setTotalRewardPoints(storedRewards.totalPoints);
        setDailyRewardPoints(storedRewards.dailyEarned);
        setRewardsLoaded(true);
      }
    };

    loadRewards();

    return () => {
      mounted = false;
    };
  }, [apiBase, senior?.senior_id]);

  useEffect(() => {
    if (!rewardsLoaded) {
      return;
    }

    saveStoredRewards(totalRewardPoints, dailyRewardPoints);
  }, [dailyRewardPoints, rewardsLoaded, totalRewardPoints]);

  useEffect(() => {
    if (!gameComplete || rewardGrantedThisGame || !rewardsLoaded) {
      return;
    }

    const awardGamePoints = async () => {
      setRewardGrantedThisGame(true);

      const remainingDailyPoints = Math.max(0, DAILY_REWARD_CAP - dailyRewardPoints);
      const pointsToAdd = Math.min(GAME_COMPLETION_REWARD, remainingDailyPoints);

      if (pointsToAdd <= 0) {
        setMessage('Daily reward cap reached. Come back tomorrow for more kopi points.');
        return;
      }

      if (apiBase && senior?.senior_id) {
        try {
          const response = await fetch(`${apiBase}/rewards/senior/${senior.senior_id}/game-points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points: pointsToAdd }),
          });

          const rewardData = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(rewardData?.error || 'Unable to save kopi points.');
          }

          setDailyRewardPoints(Number(rewardData?.daily_points || 0));
          setTotalRewardPoints(Number(rewardData?.total_points || 0));
          setMessage(
            rewardData?.awarded_points > 0
              ? `Well done. You earned ${rewardData.awarded_points} kopi points today.`
              : 'Daily reward cap reached. Come back tomorrow for more kopi points.'
          );
          return;
        } catch (error) {
          console.log('Failed to save backend kopi points:', error);
        }
      }

      setDailyRewardPoints((currentPoints) => currentPoints + pointsToAdd);
      setTotalRewardPoints((currentPoints) => currentPoints + pointsToAdd);
      setMessage(`Well done. You earned ${pointsToAdd} kopi points today.`);
    };

    awardGamePoints();
  }, [apiBase, dailyRewardPoints, gameComplete, rewardGrantedThisGame, rewardsLoaded, senior?.senior_id]);

  const resetGame = () => {
    setCards(createDeck());
    setFlippedIds([]);
    setMatchedKeys([]);
    setAttempts(0);
    setScore(0);
    setMessage('Tap two cards to find a matching pair.');
    setIsChecking(false);
    setRewardGrantedThisGame(false);
  };

  const redeemKopi = () => {
    if (!canRedeemKopi) {
      return;
    }

    const redeemOnBackend = async () => {
      if (apiBase && senior?.senior_id) {
        try {
          const response = await fetch(`${apiBase}/rewards/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senior_id: senior.senior_id, reward_name: 'Kopi' }),
          });

          if (!response.ok) {
            throw new Error('Unable to redeem kopi right now.');
          }
        } catch (error) {
          console.log('Failed to redeem kopi on backend:', error);
        }
      }

      setTotalRewardPoints((currentPoints) => currentPoints - KOPI_COST);
      setMessage('Kopi redeemed. Enjoy your treat!');
    };

    redeemOnBackend();
  };

  const handleCardPress = (card) => {
    if (
      isChecking ||
      gameComplete ||
      flippedIds.includes(card.id) ||
      matchedKeys.includes(card.key)
    ) {
      return;
    }

    const nextFlippedIds = [...flippedIds, card.id];
    setFlippedIds(nextFlippedIds);

    if (nextFlippedIds.length === 1) {
      setMessage('Pick one more card.');
      return;
    }

    const [firstCardId, secondCardId] = nextFlippedIds;
    const firstCard = cards.find((item) => item.id === firstCardId);
    const secondCard = cards.find((item) => item.id === secondCardId);

    setAttempts((currentAttempts) => currentAttempts + 1);
    setIsChecking(true);

    if (firstCard?.key === secondCard?.key) {
      setTimeout(() => {
        setMatchedKeys((currentMatches) => [...currentMatches, card.key]);
        setScore((currentScore) => currentScore + 100);
        setFlippedIds([]);
        setIsChecking(false);
        setMessage('Nice match. Keep going.');
      }, 450);
      return;
    }

    setTimeout(() => {
      setFlippedIds([]);
      setIsChecking(false);
      setMessage('Not a match. Try again.');
    }, 850);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Memory Match" subtitle="Find 8 pairs in a 4 by 4 grid" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <Ionicons name={gameComplete ? 'trophy' : 'albums'} size={24} color="#2563EB" />
          <View style={styles.messageCopy}>
            <Text style={styles.messageTitle}>{gameComplete ? 'Game complete' : progressText}</Text>
            <Text style={styles.messageText}>{gameComplete ? progressText : message}</Text>
          </View>
        </View>

        <View style={styles.memoryGrid}>
          {cards.map((card) => {
            const isFaceUp = flippedIds.includes(card.id) || matchedKeys.includes(card.key);

            return (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.memoryCard,
                  isFaceUp ? { backgroundColor: card.background, borderColor: card.color } : styles.memoryCardBack,
                  matchedKeys.includes(card.key) ? styles.memoryCardMatched : null,
                ]}
                onPress={() => handleCardPress(card)}
                activeOpacity={0.86}
              >
                {isFaceUp ? (
                  <>
                    <Ionicons name={card.icon} size={30} color={card.color} />
                    <Text style={[styles.cardLabel, { color: card.color }]}>{card.label}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="help" size={36} color="#FFFFFF" />
                    <Text style={styles.cardBackText}>Tap</Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.attemptText}>{attempts} attempt(s)</Text>

        <TouchableOpacity style={styles.resetButton} onPress={resetGame} activeOpacity={0.86}>
          <Ionicons name="refresh" size={22} color="#FFFFFF" />
          <Text style={styles.resetButtonText}>{gameComplete ? 'Play again' : 'Restart game'}</Text>
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

      <SeniorBottomNav onHome={onHome} onCommunity={() => {}} onProfile={onProfile} onSettings={onSettings} activeTab="Community" />
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
  memoryGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  memoryCard: {
    width: '23.5%',
    aspectRatio: 0.92,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  memoryCardBack: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  memoryCardMatched: {
    opacity: 0.72,
  },
  cardLabel: { fontSize: 11, fontWeight: '900', marginTop: 5 },
  cardBackText: { color: '#DBEAFE', fontSize: 11, fontWeight: '900', marginTop: 3 },
  attemptText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
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

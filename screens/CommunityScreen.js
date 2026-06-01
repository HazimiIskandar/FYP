import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';

const scamQuestions = [
  {
    scenario: 'You get a WhatsApp from a +62 number saying your Shopee parcel is stuck. They ask you to tap a link and pay $1. What should you do?',
    answers: ['Tap the link and pay', 'Ignore and check Shopee app directly', 'Forward it to family and friends'],
    correctAnswer: 'Ignore and check Shopee app directly',
  },
  {
    scenario: 'Someone calls and says they are from your bank. They ask for your OTP to stop a suspicious transaction. What should you do?',
    answers: ['Give the OTP quickly', 'Hang up and call the bank hotline', 'Ask them to call back later'],
    correctAnswer: 'Hang up and call the bank hotline',
  },
  {
    scenario: 'A message says you won a supermarket voucher, but you must enter your Singpass details first. What should you do?',
    answers: ['Enter Singpass to claim', 'Delete the message', 'Send your NRIC instead'],
    correctAnswer: 'Delete the message',
  },
  {
    scenario: 'A new online friend asks you to transfer money because their account is frozen. What should you do?',
    answers: ['Transfer a small amount first', 'Say no and tell a trusted person', 'Share your bank account number'],
    correctAnswer: 'Say no and tell a trusted person',
  },
];

export default function CommunityScreen({ onHome, onLogout }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const timeoutRef = useRef(null);
  const currentQuestion = scamQuestions[currentQuestionIndex];
  const quizComplete = currentQuestionIndex >= scamQuestions.length;

  useEffect(() => () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleAnswer = (answer) => {
    if (selectedAnswer) {
      return;
    }

    setSelectedAnswer(answer);

    if (answer === currentQuestion.correctAnswer) {
      setScore((currentScore) => currentScore + 1);
    }

    timeoutRef.current = setTimeout(() => {
      setSelectedAnswer(null);
      setCurrentQuestionIndex((index) => index + 1);
    }, 900);
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
  };

  const getAnswerStyle = (answer) => {
    if (!selectedAnswer) {
      return null;
    }

    if (answer === currentQuestion.correctAnswer) {
      return styles.answerCorrect;
    }

    if (answer === selectedAnswer) {
      return styles.answerWrong;
    }

    return styles.answerDimmed;
  };

  const getAnswerTextStyle = (answer) => {
    if (!selectedAnswer) {
      return null;
    }

    if (answer === currentQuestion.correctAnswer || answer === selectedAnswer) {
      return styles.answerTextSelected;
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Spot the Scam" subtitle="Daily quiz to stay safe from scams" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.scoreCard}>
          <View style={styles.scoreIcon}>
            <Ionicons name="shield-checkmark" size={30} color="#2563EB" />
          </View>
          <View style={styles.scoreCopy}>
            <Text style={styles.scoreTitle}>Today's safety points</Text>
            <Text style={styles.scoreText}>{score} / {scamQuestions.length} correct</Text>
          </View>
        </View>

        {quizComplete ? (
          <View style={styles.completeCard}>
            <Ionicons name="trophy" size={72} color="#F59E0B" />
            <Text style={styles.completeTitle}>Quiz complete</Text>
            <Text style={styles.completeText}>
              You scored {score} out of {scamQuestions.length}. Great job practising scam safety today.
            </Text>
            <TouchableOpacity style={styles.restartButton} onPress={restartQuiz} activeOpacity={0.86}>
              <Text style={styles.restartButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.questionCard}>
              <View style={styles.questionMetaRow}>
                <Text style={styles.questionMeta}>Question {currentQuestionIndex + 1} of {scamQuestions.length}</Text>
                <Text style={styles.dailyPill}>Daily Quiz</Text>
              </View>
              <Text style={styles.questionTitle}>What would you do?</Text>
              <Text style={styles.scenarioText}>{currentQuestion.scenario}</Text>
            </View>

            <View style={styles.answerArea}>
              {currentQuestion.answers.map((answer) => (
                <TouchableOpacity
                  key={answer}
                  style={[styles.answerButton, getAnswerStyle(answer)]}
                  onPress={() => handleAnswer(answer)}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.answerText, getAnswerTextStyle(answer)]}>{answer}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.kopiButton} activeOpacity={0.86}>
          <Ionicons name="cafe" size={28} color="#FFFFFF" />
          <View style={styles.kopiCopy}>
            <Text style={styles.kopiButtonText}>Redeem free kopi</Text>
            <Text style={styles.kopiButtonSubtext}>Available after 7 daily check-ins</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <SeniorBottomNav onHome={onHome} onCommunity={() => {}} onLogout={onLogout} activeTab="Community" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 28 },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  scoreIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scoreCopy: { flex: 1 },
  scoreTitle: { color: '#111827', fontSize: 20, fontWeight: '900' },
  scoreText: { color: '#2563EB', fontSize: 16, fontWeight: '900', marginTop: 4 },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  questionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },
  questionMeta: { color: '#6B7280', fontSize: 15, fontWeight: '900' },
  dailyPill: {
    color: '#166534',
    backgroundColor: '#DCFCE7',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '900',
  },
  questionTitle: { color: '#111827', fontSize: 28, fontWeight: '900', marginBottom: 12 },
  scenarioText: { color: '#374151', fontSize: 21, lineHeight: 31, fontWeight: '700' },
  answerArea: { marginBottom: 18 },
  answerButton: {
    backgroundColor: '#FFFFFF',
    minHeight: 78,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D8E7FF',
    marginBottom: 12,
  },
  answerCorrect: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  answerWrong: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  answerDimmed: { opacity: 0.5 },
  answerText: { color: '#111827', fontSize: 20, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
  answerTextSelected: { color: '#FFFFFF' },
  completeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 18,
  },
  completeTitle: { color: '#111827', fontSize: 30, fontWeight: '900', marginTop: 12 },
  completeText: { color: '#4B5563', fontSize: 19, lineHeight: 28, textAlign: 'center', marginTop: 10 },
  restartButton: {
    backgroundColor: '#2563EB',
    minHeight: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    marginTop: 22,
  },
  restartButtonText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  kopiButton: {
    backgroundColor: '#2563EB',
    width: '100%',
    minHeight: 78,
    borderRadius: 18,
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 18,
  },
  kopiCopy: { flex: 1, marginLeft: 12 },
  kopiButtonText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  kopiButtonSubtext: { color: '#DBEAFE', fontSize: 14, fontWeight: '700', marginTop: 3 },
});

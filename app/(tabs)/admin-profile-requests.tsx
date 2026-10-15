import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { getAllProfileChangeRequests, reviewProfileChangeRequest, type ProfileChangeRequest } from '@/lib/profile-change-requests';

export default function AdminProfileRequestsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<ProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const load = useCallback(async () => {
    try {
      if (!user) { setItems([]); return; }
      const profile = await getProfile(user.id);
      if (profile?.role !== 'admin') { setItems([]); return; }
      setItems(await getAllProfileChangeRequests());
    } catch (error: any) {
      Alert.alert('Unable to load requests', error?.message || 'Check that the database migration has been applied.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const review = (item: ProfileChangeRequest, approve: boolean) => {
    Alert.alert(
      approve ? 'Approve Correction?' : 'Reject Correction?',
      `${item.student_name || item.student_email || 'Student'}\n${item.request_type === 'name' ? 'Name' : 'School ID'}: ${item.requested_value}${approve ? '\n\nApproving applies this change to the student profile.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approve ? 'Approve' : 'Reject',
          style: approve ? 'default' : 'destructive',
          onPress: () => doReview(item, approve, ''),
        },
      ],
    );
  };

  const doReview = async (item: ProfileChangeRequest, approve: boolean, note: string) => {
    setProcessingId(item.id);
    try {
      await reviewProfileChangeRequest(item.id, approve, note);
      await load();
      Alert.alert('Review complete', approve ? 'The correction was approved and applied.' : 'The correction request was rejected.');
    } catch (error: any) {
      Alert.alert('Unable to review request', error?.message || 'Please try again.');
    } finally { setProcessingId(null); }
  };

  const visibleItems = filter === 'pending' ? items.filter(item => item.status === 'pending') : items;
  const pendingCount = items.filter(item => item.status === 'pending').length;

  if (loading) return <SafeAreaView style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.muted}>Loading correction requests...</Text></SafeAreaView>;
  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={visibleItems}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View>
          <Text style={styles.eyebrow}>SYSTEM REPORTS</Text>
          <Text style={styles.title}>Profile Correction Requests</Text>
          <Text style={styles.subtitle}>Review student requests to correct their registered name or School ID.</Text>
          <View style={styles.summaryCard}><View style={styles.summaryIcon}><Ionicons name="document-text-outline" size={22} color={COLORS.primaryLight} /></View><View style={styles.summaryCopy}><Text style={styles.summaryNumber}>{pendingCount}</Text><Text style={styles.summaryLabel}>Pending requests</Text></View></View>
          <View style={styles.filterRow}>
            <Pressable style={[styles.filterButton, filter === 'pending' && styles.filterActive]} onPress={() => setFilter('pending')}><Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>Pending ({pendingCount})</Text></Pressable>
            <Pressable style={[styles.filterButton, filter === 'all' && styles.filterActive]} onPress={() => setFilter('all')}><Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All requests ({items.length})</Text></Pressable>
          </View>
        </View>}
        ListEmptyComponent={<View style={styles.emptyCard}><Ionicons name="checkmark-done-circle-outline" size={36} color={COLORS.success} /><Text style={styles.emptyTitle}>{filter === 'pending' ? 'No pending requests' : 'No requests yet'}</Text><Text style={styles.muted}>Student correction requests will appear here.</Text></View>}
        renderItem={({ item }) => {
          const pending = item.status === 'pending';
          return <View style={styles.requestCard}>
            <View style={styles.cardTop}><View style={styles.typeIcon}><Ionicons name={item.request_type === 'name' ? 'person-outline' : 'card-outline'} size={21} color={COLORS.primaryLight} /></View><View style={styles.cardHeading}><Text style={styles.studentName}>{item.student_name || 'Student account'}</Text><Text style={styles.studentEmail}>{item.student_email || item.user_id}</Text></View><Text style={[styles.status, { color: item.status === 'approved' ? COLORS.success : item.status === 'rejected' ? COLORS.error : COLORS.info }]}>{item.status.toUpperCase()}</Text></View>
            <Text style={styles.fieldLabel}>{item.request_type === 'name' ? 'NAME CORRECTION' : 'SCHOOL ID CORRECTION'}</Text>
            <View style={styles.valueBox}><Text style={styles.smallLabel}>Current value</Text><Text style={styles.oldValue}>{item.current_value || 'Not provided'}</Text></View>
            <View style={styles.valueBox}><Text style={styles.smallLabel}>Requested value</Text><Text style={styles.newValue}>{item.requested_value}</Text></View>
            <Text style={styles.fieldLabel}>Reason provided</Text><Text style={styles.reason}>{item.reason}</Text>
            <Text style={styles.dateText}>Submitted {new Date(item.created_at).toLocaleString()}</Text>
            {item.admin_note ? <Text style={styles.note}>Admin note: {item.admin_note}</Text> : null}
            {pending ? <View style={styles.actions}><Pressable style={[styles.actionButton, styles.approveButton]} onPress={() => review(item, true)} disabled={!!processingId}><Text style={styles.approveText}>{processingId === item.id ? 'Processing...' : 'Approve'}</Text></Pressable><Pressable style={[styles.actionButton, styles.rejectButton]} onPress={() => review(item, false)} disabled={!!processingId}><Text style={styles.rejectText}>Reject</Text></Pressable></View> : null}
          </View>;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 18, paddingBottom: 32, gap: 12, flexGrow: 1 },
  eyebrow: { color: COLORS.primaryLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 7 },
  title: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 7 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 17, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15, padding: 15 },
  summaryIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { gap: 2 }, summaryNumber: { color: COLORS.textPrimary, fontSize: 23, fontWeight: '900' }, summaryLabel: { color: COLORS.textSecondary, fontSize: 12 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 13, marginBottom: 5 },
  filterButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  filterActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary }, filterText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }, filterTextActive: { color: COLORS.primaryLight },
  requestCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginTop: 12, gap: 9 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, typeIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center' }, cardHeading: { flex: 1, minWidth: 0, gap: 3 }, studentName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' }, studentEmail: { color: COLORS.textSecondary, fontSize: 11 }, status: { fontSize: 10, fontWeight: '900' },
  fieldLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 4 }, valueBox: { backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 10, padding: 10, gap: 4 }, smallLabel: { color: COLORS.textMuted, fontSize: 10 }, oldValue: { color: COLORS.textSecondary, fontSize: 13 }, newValue: { color: COLORS.primaryLight, fontSize: 14, fontWeight: '800' }, reason: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 19 }, dateText: { color: COLORS.textMuted, fontSize: 10 }, note: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 5 }, actionButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 }, approveButton: { backgroundColor: COLORS.successBackground }, rejectButton: { backgroundColor: COLORS.errorBackground }, approveText: { color: COLORS.success, fontWeight: '800', fontSize: 12 }, rejectText: { color: COLORS.error, fontWeight: '800', fontSize: 12 },
  emptyCard: { alignItems: 'center', padding: 24, marginTop: 16, borderRadius: 15, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, gap: 8 }, emptyTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' }, muted: { color: COLORS.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center' },
});

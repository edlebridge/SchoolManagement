import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Send, Check, CheckCheck, Search, Users, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { cn, relativeTime } from '@/lib/utils';
import type { AppUser, Message } from '@/types';

type Tab = 'teachers' | 'parents';

interface Contact {
  user: AppUser;
  lastMessage?: Message;
  unreadCount: number;
}

export function TeacherMessages() {
  const { profile } = useAuth();
  const { students, teachers, parents, classes, classSubjects, loading } = useSchoolData();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('teachers');
  const [search, setSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<AppUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // My classes
  const myClasses = useMemo(() => {
    if (!profile) return [];
    return classes.filter(
      (c) =>
        c.class_teacher_id === profile.id ||
        classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)
    );
  }, [classes, classSubjects, profile]);

  const myClassIds = useMemo(() => myClasses.map((c) => c.id), [myClasses]);

  // My students
  const myStudents = useMemo(() => {
    if (!myClassIds.length) return [];
    return students.filter((s) => s.class_id && myClassIds.includes(s.class_id));
  }, [students, myClassIds]);

  const myStudentIds = useMemo(() => myStudents.map((s) => s.id), [myStudents]);

  // Load all messages involving this user
  const loadAllMessages = useCallback(async () => {
    if (!profile?.user_id) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${profile.user_id},recipient_id.eq.${profile.user_id}`)
      .order('created_at', { ascending: true });
    setAllMessages((data as Message[]) ?? []);
  }, [profile?.user_id]);

  useEffect(() => {
    loadAllMessages();
  }, [loadAllMessages]);

  // Teachers tab contacts: all teachers except current user
  const teacherContacts = useMemo(() => {
    return teachers.filter((t) => t.user_id !== profile?.user_id);
  }, [teachers, profile?.user_id]);

  // Parents tab contacts: parents whose children are in my classes
  const parentContacts = useMemo(() => {
    if (!myStudentIds.length) return [];
    // We need to query student_parents to find parent_user_ids for our students
    // But since we already have parents loaded, we need to match via student_parents
    // This is handled in the useEffect below
    return parents;
  }, [parents, myStudentIds]);

  // Fetch student_parents to filter parents
  const [validParentUserIds, setValidParentUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!myStudentIds.length) {
      setValidParentUserIds(new Set());
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('student_parents')
        .select('parent_user_id')
        .in('student_id', myStudentIds);
      const ids = new Set((data ?? []).map((sp) => sp.parent_user_id));
      setValidParentUserIds(ids);
    })();
  }, [myStudentIds]);

  // Filter parents to only those with children in my classes
  const filteredParentContacts = useMemo(() => {
    return parentContacts.filter((p) => validParentUserIds.has(p.user_id));
  }, [parentContacts, validParentUserIds]);

  // Current contacts based on tab
  const currentContacts = tab === 'teachers' ? teacherContacts : filteredParentContacts;

  // Build contact list with last message and unread count
  const contacts: Contact[] = useMemo(() => {
    if (!profile?.user_id) return [];
    return currentContacts
      .map((user) => {
        const conversationId = [profile.user_id, user.user_id].sort().join('|');
        const conversationMessages = allMessages.filter(
          (m) => m.conversation_id === conversationId
        );
        const lastMessage = conversationMessages[conversationMessages.length - 1];
        const unreadCount = conversationMessages.filter(
          (m) => m.recipient_id === profile.user_id && !m.read_at
        ).length;
        return { user, lastMessage, unreadCount };
      })
      .filter((c) => {
        if (!search.trim()) return true;
        return c.user.full_name.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const aTime = a.lastMessage?.created_at ?? '';
        const bTime = b.lastMessage?.created_at ?? '';
        return bTime.localeCompare(aTime);
      });
  }, [currentContacts, allMessages, profile?.user_id, search]);

  // Load conversation messages when contact selected
  const loadConversation = useCallback(async () => {
    if (!selectedContact || !profile?.user_id) return;
    const conversationId = [profile.user_id, selectedContact.user_id].sort().join('|');
    setMessagesLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) ?? []);
    setMessagesLoading(false);

    // Mark received messages as read
    const unreadIds = ((data as Message[]) ?? [])
      .filter((m) => m.recipient_id === profile.user_id && !m.read_at)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      const now = new Date().toISOString();
      await supabase
        .from('messages')
        .update({ read_at: now })
        .in('id', unreadIds);
      // Update local state
      setAllMessages((prev) =>
        prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m))
      );
      setMessages((prev) =>
        prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m))
      );
    }
  }, [selectedContact, profile?.user_id]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedContact || !profile?.user_id || !profile?.school_id) return;
    setSending(true);
    try {
      const conversationId = [profile.user_id, selectedContact.user_id].sort().join('|');
      const payload = {
        school_id: profile.school_id,
        sender_id: profile.user_id,
        recipient_id: selectedContact.user_id,
        body: newMessage.trim(),
        conversation_id: conversationId,
        message_type: 'text',
        read_at: null,
      };

      const { data, error } = await supabase.from('messages').insert(payload).select().single();
      if (error) throw error;

      const newMsg = data as Message;
      setMessages((prev) => [...prev, newMsg]);
      setAllMessages((prev) => [...prev, newMsg]);
      setNewMessage('');
      toast('Message sent');
    } catch {
      toast('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  // Get conversation ID for selected contact
  const conversationId = useMemo(() => {
    if (!selectedContact || !profile?.user_id) return '';
    return [profile.user_id, selectedContact.user_id].sort().join('|');
  }, [selectedContact, profile?.user_id]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!profile?.user_id) return;
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${profile.user_id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setAllMessages((prev) => [...prev, newMsg]);
          // If in conversation with sender, add to messages and mark read
          if (selectedContact && newMsg.sender_id === selectedContact.user_id) {
            setMessages((prev) => [...prev, newMsg]);
            // Mark as read
            supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMsg.id)
              .then(() => {
                setAllMessages((prev) =>
                  prev.map((m) =>
                    m.id === newMsg.id ? { ...m, read_at: new Date().toISOString() } : m
                  )
                );
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === newMsg.id ? { ...m, read_at: new Date().toISOString() } : m
                  )
                );
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, selectedContact]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Messages" subtitle="Chat with teachers and parents" icon={<MessageSquare className="h-5 w-5" />} />
        <Card>
          <RowSkeleton rows={6} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle="Chat with teachers and parents of your students"
        icon={<MessageSquare className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Contact List */}
        <Card className="lg:col-span-1">
          {/* Tabs */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => { setTab('teachers'); setSelectedContact(null); }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                tab === 'teachers'
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-light'
                  : 'text-ink-muted hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <Users className="h-4 w-4" />
              Teachers
              {teacherContacts.length > 0 && (
                <Badge variant={tab === 'teachers' ? 'primary' : 'secondary'}>{teacherContacts.length}</Badge>
              )}
            </button>
            <button
              onClick={() => { setTab('parents'); setSelectedContact(null); }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                tab === 'parents'
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-light'
                  : 'text-ink-muted hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <User className="h-4 w-4" />
              Parents
              {filteredParentContacts.length > 0 && (
                <Badge variant={tab === 'parents' ? 'primary' : 'secondary'}>{filteredParentContacts.length}</Badge>
              )}
            </button>
          </div>

          {/* Search */}
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />

          {/* Contacts */}
          <div className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <EmptyState
                title={tab === 'teachers' ? 'No teachers' : 'No parents'}
                description={
                  tab === 'teachers'
                    ? 'No other teachers found in your school.'
                    : 'No parents with children in your classes found.'
                }
              />
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.user.id}
                  onClick={() => setSelectedContact(contact.user)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors',
                    selectedContact?.id === contact.user.id
                      ? 'bg-primary-50 dark:bg-primary-500/15'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  <Avatar name={contact.user.full_name} src={contact.user.avatar_url} size="sm" />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-ink dark:text-slate-100 truncate">{contact.user.full_name}</p>
                      {contact.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-semibold text-white">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                    {contact.lastMessage && (
                      <p className="text-xs text-ink-muted truncate">
                        {contact.lastMessage.sender_id === profile?.user_id ? 'You: ' : ''}
                        {contact.lastMessage.body}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat Panel */}
        <Card className="lg:col-span-2 flex flex-col" >
          {!selectedContact ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <EmptyState
                title="Select a contact"
                description="Choose a teacher or parent to start chatting."
                icon={<MessageSquare className="h-10 w-10" />}
              />
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <Avatar name={selectedContact.full_name} src={selectedContact.avatar_url} size="md" />
                <div>
                  <p className="font-semibold text-ink dark:text-slate-100">{selectedContact.full_name}</p>
                  <p className="text-sm text-ink-muted">
                    {selectedContact.phone ?? 'No phone'} · {tab === 'teachers' ? 'Teacher' : 'Parent'}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto py-4" style={{ maxHeight: '50vh' }}>
                {messagesLoading ? (
                  <RowSkeleton rows={4} />
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-10">
                    <p className="text-sm text-ink-muted">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSent = msg.sender_id === profile?.user_id;
                    const isRead = !!msg.read_at;
                    return (
                      <div
                        key={msg.id}
                        className={cn('flex', isSent ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2.5',
                            isSent
                              ? 'bg-primary-600 text-white'
                              : 'bg-slate-100 text-ink dark:bg-slate-800 dark:text-slate-100'
                          )}
                        >
                          <p className="text-sm">{msg.body}</p>
                          <div className={cn('mt-1 flex items-center gap-1 text-xs', isSent ? 'text-primary-100' : 'text-ink-muted')}>
                            <span>{relativeTime(msg.created_at)}</span>
                            {isSent && (
                              isRead ? (
                                <CheckCheck className="h-3.5 w-3.5" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Send Message */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    loading={sending}
                    disabled={!newMessage.trim()}
                    leftIcon={<Send className="h-4 w-4" />}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

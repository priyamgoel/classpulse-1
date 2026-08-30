import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/auth_service.dart';
import '../services/classroom_service.dart';
import '../theme/tokens.dart';
import 'create_doubt_screen.dart';
import 'doubt_detail_screen.dart';

class DoubtForumScreen extends StatefulWidget {
  final String? initialClassroomId;

  const DoubtForumScreen({super.key, this.initialClassroomId});

  @override
  State<DoubtForumScreen> createState() => _DoubtForumScreenState();
}

class _DoubtForumScreenState extends State<DoubtForumScreen> {
  List<Classroom> _classrooms = [];
  String? _selectedClassroomId;
  Classroom? _selectedClassroom;
  bool _isLoadingClassrooms = true;

  List<dynamic> _posts = [];
  List<dynamic> _topics = [];
  bool _isLoadingPosts = false;

  String _scopeFilter = 'ALL';
  String? _selectedTopicId;
  final String _statusFilter = 'ALL';
  final String _sortBy = 'recent';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchClassrooms();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchClassrooms() async {
    try {
      final classrooms = await ClassroomService.fetchMyClassrooms();
      setState(() {
        _classrooms = classrooms;
        if (classrooms.isNotEmpty) {
          if (widget.initialClassroomId != null) {
            _selectedClassroomId = widget.initialClassroomId;
            _selectedClassroom = classrooms.firstWhere(
              (c) => c.id == widget.initialClassroomId,
              orElse: () => classrooms.first,
            );
          } else {
            _selectedClassroomId = classrooms.first.id;
            _selectedClassroom = classrooms.first;
          }
        }
        _isLoadingClassrooms = false;
      });

      if (_selectedClassroom != null) {
        _fetchTopics();
        _fetchPosts();
      }
    } catch (_) {
      setState(() => _isLoadingClassrooms = false);
    }
  }

  Future<void> _fetchTopics() async {
    if (_selectedClassroom == null) return;
    try {
      final token = AuthService.token;
      final res = await http.get(
        Uri.parse('${AuthService.baseUrl}/courses/${_selectedClassroom!.courseId}/topics'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _topics = data['topics'] ?? [];
        });
      }
    } catch (_) {}
  }

  Future<void> _fetchPosts() async {
    if (_selectedClassroom == null) return;
    setState(() => _isLoadingPosts = true);

    try {
      final token = AuthService.token;
      final queryText = _searchController.text.trim();
      String url = '';

      if (queryText.isNotEmpty) {
        url = '${AuthService.baseUrl}/search?q=${Uri.encodeComponent(queryText)}&course_id=${_selectedClassroom!.courseId}';
      } else {
        url = '${AuthService.baseUrl}/doubts?course_id=${_selectedClassroom!.courseId}';
      }

      if (_selectedClassroomId != null) url += '&classroom_id=$_selectedClassroomId';
      if (_scopeFilter != 'ALL') url += '&scope=$_scopeFilter';
      if (_selectedTopicId != null) url += '&topic_id=$_selectedTopicId';
      if (_statusFilter != 'ALL') url += '&status=$_statusFilter';
      if (_sortBy.isNotEmpty && queryText.isEmpty) url += '&sort_by=$_sortBy';

      final res = await http.get(
        Uri.parse(url),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _posts = (data['results'] ?? data['posts'] ?? []) as List;
          _isLoadingPosts = false;
        });
      } else {
        setState(() => _isLoadingPosts = false);
      }
    } catch (_) {
      setState(() => _isLoadingPosts = false);
    }
  }

  Future<void> _toggleHelpful(String postId) async {
    try {
      final token = AuthService.token;
      final res = await http.post(
        Uri.parse('${AuthService.baseUrl}/doubts/helpful'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'target_type': 'POST',
          'target_id': postId,
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          final idx = _posts.indexWhere((p) => p['id'] == postId);
          if (idx != -1) {
            _posts[idx]['user_has_marked_helpful'] = data['marked'];
            _posts[idx]['helpful_count'] = data['helpful_count'];
          }
        });
      }
    } catch (_) {}
  }

  void _openCreateDoubt() async {
    if (_selectedClassroom == null) return;
    final result = await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CreateDoubtScreen(
          courseId: _selectedClassroom!.courseId,
          classroomId: _selectedClassroomId,
        ),
      ),
    );

    if (result == true) {
      _fetchTopics();
      _fetchPosts();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingClassrooms) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_classrooms.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.forum_outlined, size: 48, color: M3Tokens.outlineVariant),
              SizedBox(height: 12),
              Text(
                'No Classrooms Found',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              SizedBox(height: 4),
              Text(
                'Enroll in a course section to view and ask doubts.',
                textAlign: TextAlign.center,
                style: TextStyle(color: M3Tokens.onSurfaceVariant, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: M3Tokens.surface,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchPosts,
          child: Column(
            children: [
              // Top Section Selector Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: Colors.white,
                child: Row(
                  children: [
                    const Icon(Icons.school, size: 20, color: M3Tokens.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          isExpanded: true,
                          value: _selectedClassroomId,
                          items: _classrooms.map((c) {
                            return DropdownMenuItem(
                              value: c.id,
                              child: Text(
                                '${c.courseCode}: ${c.sectionName}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _selectedClassroomId = val;
                                _selectedClassroom = _classrooms.firstWhere((c) => c.id == val);
                              });
                              _fetchTopics();
                              _fetchPosts();
                            }
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Scope Navigation Filter Chips
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: Colors.white,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildScopeChip('ALL', 'All Scopes'),
                      const SizedBox(width: 6),
                      _buildScopeChip('CLASSROOM', 'Section Only'),
                      const SizedBox(width: 6),
                      _buildScopeChip('COURSE', 'Course-Wide'),
                      const SizedBox(width: 6),
                      _buildScopeChip('APP', 'Global App'),
                    ],
                  ),
                ),
              ),

              // Topics Horizontal Scroll
              if (_topics.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  color: Colors.white,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        FilterChip(
                          label: const Text('All Topics', style: TextStyle(fontSize: 11)),
                          selected: _selectedTopicId == null,
                          onSelected: (_) {
                            setState(() => _selectedTopicId = null);
                            _fetchPosts();
                          },
                        ),
                        const SizedBox(width: 6),
                        ..._topics.map((t) {
                          final isSel = _selectedTopicId == t['id'].toString();
                          return Padding(
                            padding: const EdgeInsets.only(right: 6.0),
                            child: FilterChip(
                              label: Text('${t['name']}', style: const TextStyle(fontSize: 11)),
                              selected: isSel,
                              onSelected: (_) {
                                setState(() => _selectedTopicId = isSel ? null : t['id'].toString());
                                _fetchPosts();
                              },
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                ),

              const Divider(height: 1),

              // Posts List
              Expanded(
                child: _isLoadingPosts
                    ? const Center(child: CircularProgressIndicator())
                    : _posts.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24.0),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.help_outline, size: 48, color: M3Tokens.outlineVariant),
                                  const SizedBox(height: 12),
                                  const Text('No Questions Found', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'Be the first student to post a question in this scope!',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(color: M3Tokens.onSurfaceVariant, fontSize: 13),
                                  ),
                                  const SizedBox(height: 16),
                                  FilledButton.icon(
                                    onPressed: _openCreateDoubt,
                                    icon: const Icon(Icons.add, size: 18),
                                    label: const Text('Ask a Doubt'),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _posts.length,
                            itemBuilder: (ctx, idx) => _buildPostListItem(_posts[idx]),
                          ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateDoubt,
        icon: const Icon(Icons.add_comment_outlined),
        label: const Text('Ask Doubt'),
      ),
    );
  }

  Widget _buildScopeChip(String value, String label) {
    final isSelected = _scopeFilter == value;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
      selected: isSelected,
      onSelected: (_) {
        setState(() => _scopeFilter = value);
        _fetchPosts();
      },
    );
  }

  Widget _buildPostListItem(Map<String, dynamic> post) {
    final isResolved = post['status'] == 'RESOLVED' || post['has_accepted_solution'] == true;
    final hasMarked = post['user_has_marked_helpful'] == true;
    final isAnonymous = post['is_anonymous'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
        border: Border.all(
          color: isResolved ? Colors.green.shade300 : M3Tokens.outlineVariant,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(M3Tokens.shapeMedium),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => DoubtDetailScreen(doubtId: post['id']),
            ),
          ).then((_) => _fetchPosts());
        },
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Scope and Solved Badges
              Row(
                children: [
                  if (isResolved)
                    Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text('SOLVED', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 9)),
                    ),
                  Container(
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: M3Tokens.primaryContainer,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      post['audience_scope'] ?? 'CLASSROOM',
                      style: const TextStyle(color: M3Tokens.onPrimaryContainer, fontWeight: FontWeight.bold, fontSize: 9),
                    ),
                  ),
                  if (post['topic_name'] != null)
                    Text(
                      post['topic_name'],
                      style: const TextStyle(color: M3Tokens.onSurfaceVariant, fontSize: 10, fontWeight: FontWeight.w600),
                    ),
                ],
              ),
              const SizedBox(height: 8),

              // Title
              Text(
                post['title'] ?? '',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: M3Tokens.onSurface),
              ),
              const SizedBox(height: 4),

              // Preview
              Text(
                post['body'] ?? '',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: M3Tokens.onSurfaceVariant, height: 1.4),
              ),
              const SizedBox(height: 12),
              const Divider(height: 1),
              const SizedBox(height: 8),

              // Footer
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        isAnonymous ? Icons.masks_outlined : Icons.person_outline,
                        size: 14,
                        color: isAnonymous ? Colors.purple : M3Tokens.onSurfaceVariant,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        post['author_display_name'] ?? 'Peer',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: M3Tokens.onSurfaceVariant),
                      ),
                    ],
                  ),

                  Row(
                    children: [
                      InkWell(
                        onTap: () => _toggleHelpful(post['id']),
                        child: Row(
                          children: [
                            Icon(
                              hasMarked ? Icons.thumb_up : Icons.thumb_up_outlined,
                              size: 13,
                              color: hasMarked ? M3Tokens.primary : M3Tokens.onSurfaceVariant,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${post['helpful_count'] ?? 0}',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: hasMarked ? M3Tokens.primary : M3Tokens.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Row(
                        children: [
                          const Icon(Icons.chat_bubble_outline, size: 13, color: M3Tokens.onSurfaceVariant),
                          const SizedBox(width: 4),
                          Text(
                            '${post['reply_count'] ?? 0}',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: M3Tokens.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

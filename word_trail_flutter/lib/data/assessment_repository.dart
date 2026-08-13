import 'package:flutter/services.dart';

import '../models/assessment.dart';

class AssessmentRepository {
  AssessmentRepository({
    AssetBundle? assetBundle,
    this.bankPath = 'assets/content/assessment/bank-v1.json',
  }) : _assetBundle = assetBundle ?? rootBundle;

  final AssetBundle _assetBundle;
  final String bankPath;
  Future<AssessmentBank>? _bankFuture;

  Future<AssessmentBank> loadBank() => _bankFuture ??= _loadBank();

  Future<AssessmentBank> _loadBank() async {
    final source = await _assetBundle.loadString(bankPath);
    return AssessmentBank.decode(source);
  }
}
